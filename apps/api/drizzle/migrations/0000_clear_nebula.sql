CREATE TABLE "board" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"primary_user_id" uuid,
	"secondary_user_id" uuid,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"access" text DEFAULT 'restricted' NOT NULL,
	"max_width" integer DEFAULT 10000,
	"max_height" integer DEFAULT 10000,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "board_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "limit_usage" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"used" integer NOT NULL,
	"user_id" uuid NOT NULL,
	"package_permission_limit_id" uuid NOT NULL
);
--> statement-breakpoint
CREATE TABLE "order_item" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"order_id" uuid NOT NULL,
	"widget_id" uuid,
	"name" text NOT NULL,
	"sku" text NOT NULL,
	"price" numeric(10, 2) NOT NULL,
	"quantity" integer DEFAULT 1 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "order" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"idempotency_key" text NOT NULL,
	"board_id" uuid,
	"buyer_user_id" text,
	"buyer_name" text,
	"email" text,
	"phone" text,
	"address" text NOT NULL,
	"city" text,
	"postal_code" text,
	"country" text,
	"amount_total" numeric(10, 2) NOT NULL,
	"payment_method" text DEFAULT 'card' NOT NULL,
	"card_last4" text,
	"status" text DEFAULT 'paid' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "order_idempotency_key_unique" UNIQUE("idempotency_key")
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
	"price" text DEFAULT '0' NOT NULL,
	"primary_user_id" uuid,
	"secondary_user_id" uuid
);
--> statement-breakpoint
CREATE TABLE "permissions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"action" text NOT NULL,
	"subject" text NOT NULL,
	"name" text NOT NULL,
	"description" text,
	CONSTRAINT "action_subject_uniq" UNIQUE("action","subject")
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
CREATE TABLE "smart_widget" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"primary_user_id" uuid,
	"secondary_user_id" uuid,
	"board_id" uuid,
	"sku" text NOT NULL,
	"photo" text,
	"quantity" integer NOT NULL,
	"price" numeric,
	"name" text NOT NULL,
	"pos_x" numeric,
	"pos_y" numeric,
	"width" integer NOT NULL,
	"height" integer NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
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
CREATE TABLE "user" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"password" text,
	"provider" text,
	"refresh_token" text,
	"reset_password_token" text,
	"reset_password_expires_at" timestamp,
	"primary_user_id" uuid,
	"secondary_user_id" uuid
);
--> statement-breakpoint
ALTER TABLE "board" ADD CONSTRAINT "board_primary_user_id_user_id_fk" FOREIGN KEY ("primary_user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "board" ADD CONSTRAINT "board_secondary_user_id_user_id_fk" FOREIGN KEY ("secondary_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "limit_usage" ADD CONSTRAINT "limit_usage_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "limit_usage" ADD CONSTRAINT "limit_usage_package_permission_limit_id_package_permission_limit_id_fk" FOREIGN KEY ("package_permission_limit_id") REFERENCES "public"."package_permission_limit"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_item" ADD CONSTRAINT "order_item_order_id_order_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."order"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order" ADD CONSTRAINT "order_board_id_board_id_fk" FOREIGN KEY ("board_id") REFERENCES "public"."board"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "package_permission_limit" ADD CONSTRAINT "package_permission_limit_package_id_package_id_fk" FOREIGN KEY ("package_id") REFERENCES "public"."package"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "package_permission_limit" ADD CONSTRAINT "package_permission_limit_permission_id_permissions_id_fk" FOREIGN KEY ("permission_id") REFERENCES "public"."permissions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "package" ADD CONSTRAINT "package_primary_user_id_user_id_fk" FOREIGN KEY ("primary_user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "package" ADD CONSTRAINT "package_secondary_user_id_user_id_fk" FOREIGN KEY ("secondary_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "role_permission" ADD CONSTRAINT "role_permission_role_id_role_id_fk" FOREIGN KEY ("role_id") REFERENCES "public"."role"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "role_permission" ADD CONSTRAINT "role_permission_permission_id_permissions_id_fk" FOREIGN KEY ("permission_id") REFERENCES "public"."permissions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "role" ADD CONSTRAINT "role_primary_user_id_user_id_fk" FOREIGN KEY ("primary_user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "role" ADD CONSTRAINT "role_secondary_user_id_user_id_fk" FOREIGN KEY ("secondary_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "smart_widget" ADD CONSTRAINT "smart_widget_primary_user_id_user_id_fk" FOREIGN KEY ("primary_user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "smart_widget" ADD CONSTRAINT "smart_widget_secondary_user_id_user_id_fk" FOREIGN KEY ("secondary_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "smart_widget" ADD CONSTRAINT "smart_widget_board_id_board_id_fk" FOREIGN KEY ("board_id") REFERENCES "public"."board"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subscription" ADD CONSTRAINT "subscription_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subscription" ADD CONSTRAINT "subscription_package_id_package_id_fk" FOREIGN KEY ("package_id") REFERENCES "public"."package"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_role" ADD CONSTRAINT "user_role_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_role" ADD CONSTRAINT "user_role_role_id_role_id_fk" FOREIGN KEY ("role_id") REFERENCES "public"."role"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user" ADD CONSTRAINT "user_primary_user_fk" FOREIGN KEY ("primary_user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user" ADD CONSTRAINT "user_secondary_user_fk" FOREIGN KEY ("secondary_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "limit_usage_pkg_perm_limit_user_id_idx" ON "limit_usage" USING btree ("package_permission_limit_id","user_id");--> statement-breakpoint
CREATE INDEX "pkg_perm_limit_package_id_idx" ON "package_permission_limit" USING btree ("package_id");--> statement-breakpoint
CREATE INDEX "pkg_perm_limit_permission_id_idx" ON "package_permission_limit" USING btree ("permission_id");--> statement-breakpoint
CREATE INDEX "role_permission_role_id_idx" ON "role_permission" USING btree ("role_id");--> statement-breakpoint
CREATE INDEX "role_permission_permission_id_idx" ON "role_permission" USING btree ("permission_id");--> statement-breakpoint
CREATE INDEX "role_primary_user_id_idx" ON "role" USING btree ("primary_user_id");--> statement-breakpoint
CREATE INDEX "subscription_user_id_idx" ON "subscription" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "user_role_user_id_idx" ON "user_role" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "user_role_role_id_idx" ON "user_role" USING btree ("role_id");