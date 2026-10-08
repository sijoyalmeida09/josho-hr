-- 0008_fix_audit_constraint.sql
-- Fix: tg_op returns uppercase (INSERT, UPDATE, DELETE) but the check
-- constraint only allowed lowercase values. Use lower() to accept both.

ALTER TABLE public.admin_audit DROP CONSTRAINT IF EXISTS admin_audit_action_check;
ALTER TABLE public.admin_audit ADD CONSTRAINT admin_audit_action_check
  CHECK (lower(action) IN ('select', 'insert', 'update', 'delete'));
