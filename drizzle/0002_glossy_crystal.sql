CREATE TABLE "automation_setting" (
	"user_id" text PRIMARY KEY NOT NULL,
	"enabled" boolean DEFAULT false NOT NULL,
	"frequency" text DEFAULT 'weekly' NOT NULL,
	"last_draft_at" timestamp,
	"source_type" text DEFAULT 'notion_recent' NOT NULL,
	"source_page_id" text,
	"source_lookback_days" integer DEFAULT 5,
	"prompt" text,
	"publish_day_of_week" integer,
	"publish_time" text DEFAULT '09:00' NOT NULL,
	"timezone" text DEFAULT 'America/New_York' NOT NULL,
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "generated_post" ADD COLUMN "source" text DEFAULT 'manual' NOT NULL;--> statement-breakpoint
ALTER TABLE "generated_post" ADD COLUMN "scheduled_for" timestamp;--> statement-breakpoint
ALTER TABLE "generated_post" ADD COLUMN "published_at" timestamp;--> statement-breakpoint
ALTER TABLE "generated_post" ADD COLUMN "linkedin_post_urn" text;--> statement-breakpoint
ALTER TABLE "generated_post" ADD COLUMN "failure_reason" text;--> statement-breakpoint
ALTER TABLE "generated_post" ADD COLUMN "source_content" text;--> statement-breakpoint
ALTER TABLE "generated_post" ADD COLUMN "edit_conversation" json DEFAULT '[]'::json;--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "linkedin_access_token" text;--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "linkedin_member_urn" text;--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "linkedin_token_expires_at" timestamp;--> statement-breakpoint
ALTER TABLE "automation_setting" ADD CONSTRAINT "automation_setting_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;