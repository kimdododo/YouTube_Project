-- user_travel_preferences 테이블 생성
CREATE TABLE IF NOT EXISTS `user_travel_preferences` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `user_id` INT NOT NULL,
  `preference_id` INT NOT NULL COMMENT '여행 취향 ID (1-11)',
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_user_preference` (`user_id`, `preference_id`),
  INDEX `ix_user_travel_preferences_id` (`id`),
  INDEX `ix_user_travel_preferences_user_id` (`user_id`),
  CONSTRAINT `fk_user_travel_preferences_user_id` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

