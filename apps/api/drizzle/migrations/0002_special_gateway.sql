ALTER TABLE "group" DROP CONSTRAINT "group_created_by_user_id_user_id_fk";
--> statement-breakpoint
ALTER TABLE "group" ADD COLUMN "granted_by_user_id" uuid;--> statement-breakpoint
ALTER TABLE "group" ADD CONSTRAINT "group_granted_by_user_id_user_id_fk" FOREIGN KEY ("granted_by_user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "group" ADD CONSTRAINT "group_created_by_user_id_user_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;