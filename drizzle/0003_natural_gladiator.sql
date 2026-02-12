ALTER TABLE `pages` ADD `placementConfidence` int DEFAULT 100;--> statement-breakpoint
ALTER TABLE `pages` ADD `needsValidation` enum('yes','no') DEFAULT 'no' NOT NULL;