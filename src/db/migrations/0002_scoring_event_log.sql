ALTER TABLE "match_updates" ALTER COLUMN "created_at" SET DEFAULT clock_timestamp();--> statement-breakpoint
ALTER TABLE "match_updates" ADD COLUMN "client_event_id" uuid NOT NULL;--> statement-breakpoint
ALTER TABLE "match_updates" ADD COLUMN "device_time" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "match_updates" ADD COLUMN "voids_update_id" uuid;--> statement-breakpoint
ALTER TABLE "matches" ADD COLUMN "score_json" jsonb;--> statement-breakpoint
ALTER TABLE "match_updates" ADD CONSTRAINT "match_updates_voids_update_id_fk" FOREIGN KEY ("voids_update_id") REFERENCES "public"."match_updates"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "match_updates_match_version_uidx" ON "match_updates" USING btree ("match_id","match_version");--> statement-breakpoint
CREATE UNIQUE INDEX "match_updates_client_event_uidx" ON "match_updates" USING btree ("client_event_id");--> statement-breakpoint
CREATE UNIQUE INDEX "match_updates_voids_update_uidx" ON "match_updates" USING btree ("voids_update_id");