ALTER TABLE "order" ALTER COLUMN "buyer_name" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "order" ALTER COLUMN "email" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "order" ALTER COLUMN "city" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "order" ALTER COLUMN "country" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "order" ADD COLUMN "phone" text;