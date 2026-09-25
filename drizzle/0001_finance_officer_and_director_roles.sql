-- Rename the "Accountant" role to "Finance Officer" and add the "Director" role.
--
-- The row update MUST run between dropping and re-adding the check constraint:
-- any remaining 'accountant' value would violate the new constraint and abort
-- the migration (drizzle-kit does not generate data migrations itself).
ALTER TABLE "users" DROP CONSTRAINT IF EXISTS "users_role_check";--> statement-breakpoint
UPDATE "users" SET "role" = 'finance_officer' WHERE "role" = 'accountant';--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_role_check" CHECK ("users"."role" in ('admin', 'director', 'finance_officer', 'viewer'));
