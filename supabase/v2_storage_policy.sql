-- v2: 放行 attachments 桶的上传/删除（个人单用户系统）
-- 背景：Public bucket 只开放"读"，写入仍受 storage.objects 的 RLS 限制，
-- 前端用 publishable key 上传体检报告/照片需要此策略。

create policy "attachments_write_access" on storage.objects
  for all to anon, authenticated
  using (bucket_id = 'attachments')
  with check (bucket_id = 'attachments');
