CREATE TABLE "limit_usage" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"used" integer NOT NULL,
	"user_id" uuid NOT NULL,
	"package_permission_limit_id" uuid NOT NULL
);
--> statement-breakpoint
CREATE TABLE "package_permission_limit" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"package_id" uuid NOT NULL,
	"permission_id" uuid NOT NULL,
	"limit" integer
);
--> statement-breakpoint
CREATE TABLE "package" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" text NOT NULL,
	"slug" text NOT NULL,
	"primary_user_id" uuid,
	"secondary_user_id" uuid
);
--> statement-breakpoint
CREATE TABLE "role_permission" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"role_id" uuid NOT NULL,
	"permission_id" uuid NOT NULL
);
--> statement-breakpoint
CREATE TABLE "role" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" text NOT NULL,
	"slug" text NOT NULL,
	"primary_user_id" uuid,
	"secondary_user_id" uuid
);
--> statement-breakpoint
CREATE TABLE "subscription" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"package_id" uuid NOT NULL,
	"start_date" timestamp NOT NULL,
	"end_date" timestamp,
	"payment_method" text NOT NULL,
	"amount" numeric(10, 2) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_role" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"role_id" uuid NOT NULL
);
--> statement-breakpoint
ALTER TABLE "group_permission" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "group" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "payment_history" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "user_group" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "user_plan_snapshot" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
DROP TABLE "group_permission" CASCADE;--> statement-breakpoint
DROP TABLE "group" CASCADE;--> statement-breakpoint
DROP TABLE "payment_history" CASCADE;--> statement-breakpoint
DROP TABLE "user_group" CASCADE;--> statement-breakpoint
DROP TABLE "user_plan_snapshot" CASCADE;--> statement-breakpoint
ALTER TABLE "board" DROP CONSTRAINT "board_tenant_id_user_id_fk";
--> statement-breakpoint
ALTER TABLE "smart_widget" DROP CONSTRAINT "smart_widget_tenant_id_user_id_fk";
--> statement-breakpoint
ALTER TABLE "user" DROP CONSTRAINT "user_parent_fk";
--> statement-breakpoint
ALTER TABLE "board" ADD COLUMN "primary_user_id" uuid;--> statement-breakpoint
ALTER TABLE "board" ADD COLUMN "secondary_user_id" uuid;--> statement-breakpoint
ALTER TABLE "smart_widget" ADD COLUMN "primary_user_id" uuid;--> statement-breakpoint
ALTER TABLE "smart_widget" ADD COLUMN "secondary_user_id" uuid;--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "primary_user_id" uuid;--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "secondary_user_id" uuid;--> statement-breakpoint
ALTER TABLE "limit_usage" ADD CONSTRAINT "limit_usage_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "limit_usage" ADD CONSTRAINT "limit_usage_package_permission_limit_id_package_permission_limit_id_fk" FOREIGN KEY ("package_permission_limit_id") REFERENCES "public"."package_permission_limit"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "package_permission_limit" ADD CONSTRAINT "package_permission_limit_package_id_package_id_fk" FOREIGN KEY ("package_id") REFERENCES "public"."package"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "package_permission_limit" ADD CONSTRAINT "package_permission_limit_permission_id_permissions_id_fk" FOREIGN KEY ("permission_id") REFERENCES "public"."permissions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "package" ADD CONSTRAINT "package_primary_user_id_user_id_fk" FOREIGN KEY ("primary_user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "package" ADD CONSTRAINT "package_secondary_user_id_user_id_fk" FOREIGN KEY ("secondary_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "role_permission" ADD CONSTRAINT "role_permission_role_id_role_id_fk" FOREIGN KEY ("role_id") REFERENCES "public"."role"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "role_permission" ADD CONSTRAINT "role_permission_permission_id_permissions_id_fk" FOREIGN KEY ("permission_id") REFERENCES "public"."permissions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "role" ADD CONSTRAINT "role_primary_user_id_user_id_fk" FOREIGN KEY ("primary_user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "role" ADD CONSTRAINT "role_secondary_user_id_user_id_fk" FOREIGN KEY ("secondary_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subscription" ADD CONSTRAINT "subscription_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subscription" ADD CONSTRAINT "subscription_package_id_package_id_fk" FOREIGN KEY ("package_id") REFERENCES "public"."package"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_role" ADD CONSTRAINT "user_role_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_role" ADD CONSTRAINT "user_role_role_id_role_id_fk" FOREIGN KEY ("role_id") REFERENCES "public"."role"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "limit_usage_pkg_perm_limit_user_id_idx" ON "limit_usage" USING btree ("package_permission_limit_id","user_id");--> statement-breakpoint
CREATE INDEX "pkg_perm_limit_package_id_idx" ON "package_permission_limit" USING btree ("package_id");--> statement-breakpoint
CREATE INDEX "pkg_perm_limit_permission_id_idx" ON "package_permission_limit" USING btree ("permission_id");--> statement-breakpoint
CREATE INDEX "role_permission_role_id_idx" ON "role_permission" USING btree ("role_id");--> statement-breakpoint
CREATE INDEX "role_permission_permission_id_idx" ON "role_permission" USING btree ("permission_id");--> statement-breakpoint
CREATE INDEX "role_primary_user_id_idx" ON "role" USING btree ("primary_user_id");--> statement-breakpoint
CREATE INDEX "subscription_user_id_idx" ON "subscription" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "user_role_user_id_idx" ON "user_role" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "user_role_role_id_idx" ON "user_role" USING btree ("role_id");--> statement-breakpoint
ALTER TABLE "board" ADD CONSTRAINT "board_primary_user_id_user_id_fk" FOREIGN KEY ("primary_user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "board" ADD CONSTRAINT "board_secondary_user_id_user_id_fk" FOREIGN KEY ("secondary_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "smart_widget" ADD CONSTRAINT "smart_widget_primary_user_id_user_id_fk" FOREIGN KEY ("primary_user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "smart_widget" ADD CONSTRAINT "smart_widget_secondary_user_id_user_id_fk" FOREIGN KEY ("secondary_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user" ADD CONSTRAINT "user_primary_user_fk" FOREIGN KEY ("primary_user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user" ADD CONSTRAINT "user_secondary_user_fk" FOREIGN KEY ("secondary_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "board" DROP COLUMN "tenant_id";--> statement-breakpoint
ALTER TABLE "smart_widget" DROP COLUMN "tenant_id";--> statement-breakpoint
ALTER TABLE "user" DROP COLUMN "plan";--> statement-breakpoint
ALTER TABLE "user" DROP COLUMN "plan_expires_at";--> statement-breakpoint
ALTER TABLE "user" DROP COLUMN "parent_id";