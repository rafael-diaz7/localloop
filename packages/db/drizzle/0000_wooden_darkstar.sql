CREATE TYPE "public"."event_category" AS ENUM('music', 'arts-culture', 'food-drink', 'sports-fitness', 'family', 'community', 'education', 'outdoors', 'business-networking', 'other');--> statement-breakpoint
CREATE TYPE "public"."event_price_status" AS ENUM('free', 'paid', 'unknown');--> statement-breakpoint
CREATE TYPE "public"."event_status" AS ENUM('active', 'cancelled');--> statement-breakpoint
CREATE TABLE "event_categories" (
	"event_id" uuid NOT NULL,
	"category" "event_category" NOT NULL,
	CONSTRAINT "event_categories_event_id_category_pk" PRIMARY KEY("event_id","category")
);
--> statement-breakpoint
CREATE TABLE "events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"source" text DEFAULT 'local-seed' NOT NULL,
	"source_id" text NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"venue_id" uuid NOT NULL,
	"start_at" timestamp with time zone NOT NULL,
	"end_at" timestamp with time zone,
	"timezone" text NOT NULL,
	"price_status" "event_price_status" NOT NULL,
	"min_price_cents" integer,
	"max_price_cents" integer,
	"currency" text,
	"source_url" text NOT NULL,
	"status" "event_status" DEFAULT 'active' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "events_source_id_unique" UNIQUE("source_id")
);
--> statement-breakpoint
CREATE TABLE "venues" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"seed_id" text NOT NULL,
	"name" text NOT NULL,
	"display_address" text NOT NULL,
	"locality" text NOT NULL,
	"region" text NOT NULL,
	"postal_code" text,
	"location" geography(Point, 4326) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "venues_seed_id_unique" UNIQUE("seed_id")
);
--> statement-breakpoint
ALTER TABLE "event_categories" ADD CONSTRAINT "event_categories_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "events" ADD CONSTRAINT "events_venue_id_venues_id_fk" FOREIGN KEY ("venue_id") REFERENCES "public"."venues"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "event_categories_category_idx" ON "event_categories" USING btree ("category");--> statement-breakpoint
CREATE INDEX "events_start_at_idx" ON "events" USING btree ("start_at");--> statement-breakpoint
CREATE INDEX "events_status_start_at_idx" ON "events" USING btree ("status","start_at");--> statement-breakpoint
CREATE INDEX "events_venue_id_idx" ON "events" USING btree ("venue_id");--> statement-breakpoint
CREATE INDEX "venues_location_idx" ON "venues" USING gist ("location");--> statement-breakpoint
CREATE INDEX "venues_locality_idx" ON "venues" USING btree ("locality");
