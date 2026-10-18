#!/usr/bin/env python3
"""Generate/verify public lesson audio. Never reads .env or personal records.

Setup: python -m pip install --user edge-tts==7.3.1
Usage: python scripts/generate-thai-audio.py [--verify-only] [--limit N]
Needs Node (to export trusted local lesson JS as JSON) and ffprobe on PATH.
"""

import argparse
import asyncio
from collections import defaultdict
from datetime import datetime, timezone
import hashlib
from importlib.metadata import version
import json
from pathlib import Path
import re
import shutil
import subprocess
import sys
import tempfile


ROOT = Path(__file__).resolve().parent.parent
SOURCE = ROOT / "src/pages/Thai/thaiLessons.js"
OUTPUT = ROOT / "public/audio/thai"
MANIFEST = OUTPUT / "manifest.json"
VOICE = "th-TH-PremwadeeNeural"
RATE = "+0%"
EXPECTED_ITEMS = 210
SOURCE_URL = "https://github.com/rany2/edge-tts"


def digest(data):
    return hashlib.sha256(data).hexdigest()


def utc_now():
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


def load_items():
    if not SOURCE.is_file():
        raise RuntimeError("Course file is missing: src/pages/Thai/thaiLessons.js")
    # Fixed, trusted module only. Node exports JSON; Python never parses JS with regex.
    code = f"import {{ THAI_LESSONS }} from {json.dumps(SOURCE.as_uri())}; process.stdout.write(JSON.stringify(THAI_LESSONS));"
    result = subprocess.run(
        ["node", "--input-type=module", "-e", code],
        capture_output=True, encoding="utf-8", timeout=20, check=False,
    )
    if result.returncode:
        raise RuntimeError("Could not export the local course module through Node")
    lessons = json.loads(result.stdout)
    if len(lessons) != 30 or [lesson["day"] for lesson in lessons] != list(range(1, 31)):
        raise RuntimeError("Expected the ordered 30-day course")
    items = []
    seen = set()
    for lesson in lessons:
        for kind in ("words", "dialogue"):
            for item in lesson[kind]:
                item_id, text = item["id"], item["th"].strip()
                if not re.fullmatch(r"d\d{2}-[a-z]\d+", item_id) or item_id in seen:
                    raise RuntimeError("Course has an unsafe or duplicated audio ID")
                if not item_id.startswith(f"d{lesson['day']:02d}-"):
                    raise RuntimeError("Audio ID does not match its lesson day")
                if not text or len(text) > 250 or not re.search(r"[\u0e00-\u0e7f]", text):
                    raise RuntimeError("Course contains an empty, overlong, or non-Thai audio item")
                seen.add(item_id)
                items.append({"id": item_id, "day": lesson["day"], "kind": kind, "text": text})
    if len(items) != EXPECTED_ITEMS:
        raise RuntimeError(f"Expected {EXPECTED_ITEMS} audio items; found {len(items)}")
    return items


def probe(path):
    data = path.read_bytes()
    if not 1024 <= len(data) <= 512000:
        raise ValueError("Audio file size is outside the lesson clip bounds")
    if data[:64].lstrip().lower().startswith((b"<", b"{")):
        raise ValueError("The audio response is text rather than MP3")
    result = subprocess.run(
        ["ffprobe", "-v", "error", "-show_entries", "format=duration,format_name",
         "-show_entries", "stream=codec_name,sample_rate,channels", "-of", "json", str(path)],
        capture_output=True, encoding="utf-8", timeout=15, check=False,
    )
    if result.returncode:
        raise ValueError("ffprobe could not decode the MP3 header")
    metadata = json.loads(result.stdout)
    streams = metadata.get("streams", [])
    duration = float(metadata.get("format", {}).get("duration", 0))
    if len(streams) != 1 or streams[0].get("codec_name") != "mp3":
        raise ValueError("Expected exactly one MP3 audio stream")
    if metadata["format"]["format_name"] != "mp3" or not 0.15 <= duration <= 45:
        raise ValueError("Audio format or duration is outside the lesson clip bounds")
    return {
        "bytes": len(data), "durationSeconds": round(duration, 3),
        "sha256": digest(data), "codec": "mp3",
        "sampleRate": int(streams[0]["sample_rate"]), "channels": streams[0]["channels"],
    }


def text_hash(text):
    return digest(f"{VOICE}\n{RATE}\n{text}".encode("utf-8"))


def load_previous():
    if not MANIFEST.is_file():
        return {}
    try:
        return json.loads(MANIFEST.read_text(encoding="utf-8"))
    except (ValueError, OSError):
        raise RuntimeError("Manifest is unreadable; preserve it and repair before regenerating") from None


def valid_previous(item, previous):
    entry = previous.get("clips", {}).get(item["id"])
    if not entry or entry.get("textSha256") != text_hash(item["text"]):
        return None
    expected_fields = {
        "day": item["day"], "kind": item["kind"], "text": item["text"],
        "path": f"/audio/thai/{item['id']}.mp3",
    }
    if any(entry.get(key) != value for key, value in expected_fields.items()):
        return None
    try:
        checked = probe(OUTPUT / f"{item['id']}.mp3")
    except (ValueError, OSError, subprocess.TimeoutExpired):
        return None
    if any(entry.get(key) != value for key, value in checked.items()):
        return None
    return checked


def save_manifest(manifest, items, staging):
    clips = manifest["clips"]
    manifest["complete"] = len(clips) == len(items)
    manifest["clipCount"] = len(clips)
    manifest["uniqueTextCount"] = len({item["text"] for item in items})
    manifest["totalBytes"] = sum(clip["bytes"] for clip in clips.values())
    manifest["updatedAt"] = utc_now()
    manifest["clips"] = {key: clips[key] for key in sorted(clips)}
    temp = staging / "manifest.json"
    temp.write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    temp.replace(MANIFEST)


def verify(items, previous):
    failures = []
    for item in items:
        if valid_previous(item, previous) is None:
            failures.append(item["id"])
    expected = {f"{item['id']}.mp3" for item in items}
    extras = sorted(path.name for path in OUTPUT.glob("*.mp3") if path.name not in expected)
    if failures or extras or set(previous.get("clips", {})) != {item["id"] for item in items}:
        raise RuntimeError(f"Audio verification failed: invalid IDs={failures}; extra files={extras}")
    total = sum(clip["bytes"] for clip in previous["clips"].values())
    durations = [clip["durationSeconds"] for clip in previous["clips"].values()]
    expected_metadata = {
        "schemaVersion": 1, "complete": True, "clipCount": len(items),
        "expectedClipCount": len(items), "uniqueTextCount": len({item["text"] for item in items}),
        "totalBytes": total, "voice": VOICE, "rate": RATE, "locale": "th-TH",
        "synthetic": True, "humanPronunciationReviewed": False,
        "source": {"file": "src/pages/Thai/thaiLessons.js", "sha256": digest(SOURCE.read_bytes())},
    }
    if any(previous.get(key) != value for key, value in expected_metadata.items()):
        raise RuntimeError("Manifest course metadata, voice settings, totals or completeness are stale")
    for item in items:
        entry = previous["clips"][item["id"]]
        canonical = previous["clips"].get(entry.get("canonicalId"))
        if not canonical or canonical["text"] != entry["text"] or canonical["sha256"] != entry["sha256"]:
            raise RuntimeError(f"Invalid deduplication mapping for {item['id']}")
    print(f"Verified {len(items)} MP3 clips; {total:,} bytes; duration {min(durations):.3f}-{max(durations):.3f}s")


async def generate(items, args, staging):
    try:
        import edge_tts
    except ImportError:
        raise RuntimeError("Install the generator dependency: python -m pip install --user edge-tts==7.3.1") from None
    OUTPUT.mkdir(parents=True, exist_ok=True)
    previous = load_previous()
    groups = defaultdict(list)
    for item in items:
        groups[item["text"]].append(item)
    selected = list(groups.values())[:args.limit] if args.limit else list(groups.values())
    manifest = {
        "schemaVersion": 1,
        "source": {"file": "src/pages/Thai/thaiLessons.js", "sha256": digest(SOURCE.read_bytes())},
        "provider": "Microsoft Edge online text-to-speech",
        "generator": {"package": "edge-tts", "version": version("edge-tts"), "url": SOURCE_URL},
        "voice": VOICE, "locale": "th-TH", "rate": RATE,
        "synthetic": True, "humanPronunciationReviewed": False,
        "createdAt": previous.get("createdAt", utc_now()),
        "expectedClipCount": len(items),
        "clips": {},
    }
    # Preserve only current, verified assets; an interrupted run is safe to resume.
    for item in items:
        if valid_previous(item, previous):
            manifest["clips"][item["id"]] = previous["clips"][item["id"]]
    save_manifest(manifest, items, staging)
    semaphore = asyncio.Semaphore(args.concurrency)
    failures = []

    async def process(group):
        async with semaphore:
            canonical = group[0]
            available = next((item for item in group if item["id"] in manifest["clips"]), None)
            generated_at = utc_now()
            if available:
                canonical_path = OUTPUT / f"{available['id']}.mp3"
                generated_at = manifest["clips"][available["id"]]["generatedAt"]
                metadata = probe(canonical_path)
            else:
                canonical_path = OUTPUT / f"{canonical['id']}.mp3"
                partial = staging / f"{canonical['id']}.mp3.partial"
                for attempt in range(1, 4):
                    try:
                        await asyncio.wait_for(
                            edge_tts.Communicate(
                                canonical["text"], VOICE, rate=RATE,
                                connect_timeout=10, receive_timeout=35,
                            ).save(str(partial)),
                            timeout=50,
                        )
                        metadata = probe(partial)
                        partial.replace(canonical_path)
                        break
                    except Exception as error:  # Provider URLs/tokens must never enter logs.
                        print(f"Retry {attempt}/3 for {canonical['id']}: {type(error).__name__}", flush=True)
                        if partial.exists():
                            partial.unlink()  # Only this exact, generated partial file.
                        if attempt == 3:
                            failures.append(canonical["id"])
                            return
                        await asyncio.sleep(attempt * 2)
            for item in group:
                target = OUTPUT / f"{item['id']}.mp3"
                if target != canonical_path:
                    shutil.copyfile(canonical_path, target)
                manifest["clips"][item["id"]] = {
                    "day": item["day"], "kind": item["kind"], "text": item["text"],
                    "path": f"/audio/thai/{item['id']}.mp3",
                    "textSha256": text_hash(item["text"]),
                    "canonicalId": canonical["id"], "generatedAt": generated_at,
                    **metadata,
                }
            save_manifest(manifest, items, staging)
            print(f"Ready {len(manifest['clips'])}/{len(items)}: {canonical['id']} ({len(group)} mapping(s))", flush=True)

    await asyncio.gather(*(process(group) for group in selected))
    if failures:
        raise RuntimeError(f"Generation incomplete for {failures}; rerun to resume verified successes")
    if not args.limit:
        verify(items, manifest)
    else:
        print("Limited generation completed; run without --limit for all clips")


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--verify-only", action="store_true", help="Offline check of all course IDs, hashes and MP3 metadata")
    parser.add_argument("--limit", type=int, help="Generate only the first N unique Thai texts (for a smoke check)")
    parser.add_argument("--concurrency", type=int, choices=range(1, 5), default=3, help="Bound concurrent requests (1-4, default 3)")
    args = parser.parse_args()
    if args.limit is not None and args.limit < 1:
        parser.error("--limit must be positive")
    for executable in ("node", "ffprobe"):
        if not shutil.which(executable):
            raise RuntimeError(f"Required executable not found on PATH: {executable}")
    items = load_items()
    if args.verify_only:
        verify(items, load_previous())
    else:
        # Same filesystem allows atomic replacement, while Vite cannot copy partial
        # MP3/manifest files from public during an overlapping build.
        with tempfile.TemporaryDirectory(prefix=".thai-audio-", dir=ROOT) as staging:
            asyncio.run(generate(items, args, Path(staging)))


if __name__ == "__main__":
    try:
        main()
    except (RuntimeError, ValueError, KeyError, OSError, subprocess.TimeoutExpired) as error:
        # Local validation failures are safe; no provider response body is printed.
        print(f"Audio build failed: {error}", file=sys.stderr)
        sys.exit(1)
