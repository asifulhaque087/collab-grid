ALTER TABLE "group" ADD COLUMN "created_by_user_id" uuid;--> statement-breakpoint
ALTER TABLE "group" ADD COLUMN "created_at" timestamp DEFAULT now();--> statement-breakpoint
ALTER TABLE "group" ADD CONSTRAINT "group_created_by_user_id_user_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;