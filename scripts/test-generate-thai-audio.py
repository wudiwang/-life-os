"""Offline source-hash regression check; no audio probing or TTS calls."""

import hashlib
from pathlib import Path
import runpy
import tempfile
import unittest


GENERATOR = runpy.run_path(str(Path(__file__).with_name("generate-thai-audio.py")))


class SourceHashTests(unittest.TestCase):
    def test_lf_and_crlf_match_the_utf8_lf_hash(self):
        lf_bytes = "// 泰语课程\nexport const word = 'สวัสดี';\n".encode("utf-8")
        crlf_bytes = lf_bytes.replace(b"\n", b"\r\n")
        expected = hashlib.sha256(lf_bytes).hexdigest()
        self.assertNotEqual(hashlib.sha256(crlf_bytes).hexdigest(), expected)
        with tempfile.TemporaryDirectory(prefix="thai-source-hash-test-") as staging:
            lf_file = Path(staging) / "lf.js"
            crlf_file = Path(staging) / "crlf.js"
            lf_file.write_bytes(lf_bytes)
            crlf_file.write_bytes(crlf_bytes)
            self.assertEqual(GENERATOR["source_hash"](lf_file), expected)
            self.assertEqual(GENERATOR["source_hash"](crlf_file), expected)


if __name__ == "__main__":
    unittest.main()
