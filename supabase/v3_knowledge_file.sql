-- v3: 第二大脑支持附件（需求文档/模板/图片等，本体存 Storage，笔记挂链接）
alter table knowledge_notes add column if not exists file_url text;
