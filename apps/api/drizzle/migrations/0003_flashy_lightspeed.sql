ALTER TABLE "board" ADD COLUMN "access" text DEFAULT 'restricted' NOT NULL;--> statement-breakpoint
ALTER TABLE "board" ADD CONSTRAINT "board_slug_unique" UNIQUE("slug");