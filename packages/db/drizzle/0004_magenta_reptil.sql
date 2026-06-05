CREATE TYPE "public"."event_group_decision" AS ENUM('auto_group', 'needs_review', 'rejected', 'manual_group', 'manual_reject');--> statement-breakpoint
CREATE TABLE "event_group_members" (
	"group_id" uuid NOT NULL,
	"event_id" uuid NOT NULL,
	"score" integer NOT NULL,
	"reasons" jsonb NOT NULL,
	"decision" "event_group_decision" NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "event_group_members_group_id_event_id_pk" PRIMARY KEY("group_id","event_id")
);
--> statement-breakpoint
CREATE TABLE "event_groups" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"canonical_event_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "event_group_members" ADD CONSTRAINT "event_group_members_group_id_event_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."event_groups"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_group_members" ADD CONSTRAINT "event_group_members_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_groups" ADD CONSTRAINT "event_groups_canonical_event_id_events_id_fk" FOREIGN KEY ("canonical_event_id") REFERENCES "public"."events"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "event_group_members_event_decision_idx" ON "event_group_members" USING btree ("event_id","decision");--> statement-breakpoint
CREATE INDEX "event_group_members_decision_idx" ON "event_group_members" USING btree ("decision");--> statement-breakpoint
CREATE INDEX "event_groups_canonical_event_id_idx" ON "event_groups" USING btree ("canonical_event_id");