ALTER TABLE public.roles 
  ADD COLUMN IF NOT EXISTS kb_jd_doc_id text,
  ADD COLUMN IF NOT EXISTS kb_faq_doc_id text,
  ADD COLUMN IF NOT EXISTS tool_save_answer_id text;