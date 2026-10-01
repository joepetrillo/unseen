CREATE TABLE "sign_in_code_limits" (
	"email" text PRIMARY KEY,
	"window_started_at" timestamp with time zone NOT NULL,
	"count" integer NOT NULL
);
