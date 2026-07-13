-- phpMyAdmin SQL Dump
-- version 5.2.2
-- https://www.phpmyadmin.net/
--
-- Máy chủ: localhost:3306
-- Thời gian đã tạo: Th7 13, 2026 lúc 12:48 PM
-- Phiên bản máy phục vụ: 8.0.30
-- Phiên bản PHP: 8.3.28

SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";
START TRANSACTION;
SET time_zone = "+00:00";


/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!40101 SET NAMES utf8mb4 */;

--
-- Cơ sở dữ liệu: `ptt`
--

-- --------------------------------------------------------

--
-- Cấu trúc bảng cho bảng `audit_logs`
--

CREATE TABLE `audit_logs` (
  `id` bigint UNSIGNED NOT NULL,
  `wallet_address` varchar(42) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `action` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `details` text COLLATE utf8mb4_unicode_ci,
  `ip_address` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Cấu trúc bảng cho bảng `cache`
--

CREATE TABLE `cache` (
  `key` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `value` mediumtext COLLATE utf8mb4_unicode_ci NOT NULL,
  `expiration` bigint NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Đang đổ dữ liệu cho bảng `cache`
--

INSERT INTO `cache` (`key`, `value`, `expiration`) VALUES
('ptt-dapp-cache-4fc5e9f78f94663a9466d9c91e0ef958', 'i:1;', 1783943102),
('ptt-dapp-cache-4fc5e9f78f94663a9466d9c91e0ef958:timer', 'i:1783943102;', 1783943102),
('ptt-dapp-cache-a75f3f172bfb296f2e10cbfc6dfc1883', 'i:3;', 1783946832),
('ptt-dapp-cache-a75f3f172bfb296f2e10cbfc6dfc1883:timer', 'i:1783946832;', 1783946832),
('ptt-dapp-cache-f1f70ec40aaa556905d4a030501c0ba4', 'i:2;', 1783946820),
('ptt-dapp-cache-f1f70ec40aaa556905d4a030501c0ba4:timer', 'i:1783946820;', 1783946820);

-- --------------------------------------------------------

--
-- Cấu trúc bảng cho bảng `cache_locks`
--

CREATE TABLE `cache_locks` (
  `key` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `owner` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `expiration` bigint NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Cấu trúc bảng cho bảng `companies`
--

CREATE TABLE `companies` (
  `id` bigint UNSIGNED NOT NULL,
  `uuid` char(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `code` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `name` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `logo` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `valuation` decimal(24,4) NOT NULL DEFAULT '0.0000',
  `governance_address` varchar(42) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `token_address` varchar(42) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `funding_address` varchar(42) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `marketplace_address` varchar(42) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `status` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'ACTIVE',
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Đang đổ dữ liệu cho bảng `companies`
--

INSERT INTO `companies` (`id`, `uuid`, `code`, `name`, `logo`, `valuation`, `governance_address`, `token_address`, `funding_address`, `marketplace_address`, `status`, `created_at`, `updated_at`) VALUES
(1, '019f5b4b-8da8-72f3-aaba-03a690184dfb', 'PTT', 'CTCP Tài Sản Số PTT', NULL, 0.0000, '0x441510a37c3D2dcb82aaFd96fED18631e817787e', '0x663Fa9Eeb64674c8c2747f46E01B4Eb3c11137A3', '0xA8E7f662Ea604174379BAB0a611300c255b512CA', '0x935E32FcD54f4DDdAD0452a719d42c2F3c8baF85', 'ACTIVE', '2026-07-13 04:45:05', '2026-07-13 04:46:37');

-- --------------------------------------------------------

--
-- Cấu trúc bảng cho bảng `dividends`
--

CREATE TABLE `dividends` (
  `id` bigint UNSIGNED NOT NULL,
  `company_id` bigint UNSIGNED NOT NULL,
  `reward_token_address` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `total_amount` decimal(24,4) NOT NULL,
  `snapshot_block` bigint UNSIGNED NOT NULL,
  `payment_date` timestamp NULL DEFAULT NULL,
  `status` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'DRAFT',
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Cấu trúc bảng cho bảng `failed_jobs`
--

CREATE TABLE `failed_jobs` (
  `id` bigint UNSIGNED NOT NULL,
  `uuid` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `connection` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `queue` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `payload` longtext COLLATE utf8mb4_unicode_ci NOT NULL,
  `exception` longtext COLLATE utf8mb4_unicode_ci NOT NULL,
  `failed_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Cấu trúc bảng cho bảng `funding_rounds`
--

CREATE TABLE `funding_rounds` (
  `id` bigint UNSIGNED NOT NULL,
  `company_id` bigint UNSIGNED NOT NULL,
  `name` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `share_price` decimal(24,4) NOT NULL,
  `payment_token_address` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `payment_token_symbol` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'BNB',
  `payment_token_decimals` int NOT NULL DEFAULT '18',
  `target_amount` decimal(24,4) NOT NULL,
  `raised_amount` decimal(24,4) NOT NULL DEFAULT '0.0000',
  `start_date` timestamp NULL DEFAULT NULL,
  `end_date` timestamp NULL DEFAULT NULL,
  `status` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'DRAFT',
  `onchain_round_id` bigint UNSIGNED DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Đang đổ dữ liệu cho bảng `funding_rounds`
--

INSERT INTO `funding_rounds` (`id`, `company_id`, `name`, `share_price`, `payment_token_address`, `payment_token_symbol`, `payment_token_decimals`, `target_amount`, `raised_amount`, `start_date`, `end_date`, `status`, `onchain_round_id`, `created_at`, `updated_at`) VALUES
(2, 1, 'Vòng Seed', 1.0000, '0xa0f2afaace4cb692ea9ff666d2ef7ab054a35407', 'USDT', 18, 1000000.0000, 1.0000, '2026-07-13 04:51:13', '2026-08-12 04:51:13', 'ACTIVE', 1, '2026-07-13 04:51:13', '2026-07-13 05:43:57');

-- --------------------------------------------------------

--
-- Cấu trúc bảng cho bảng `jobs`
--

CREATE TABLE `jobs` (
  `id` bigint UNSIGNED NOT NULL,
  `queue` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `payload` longtext COLLATE utf8mb4_unicode_ci NOT NULL,
  `attempts` smallint UNSIGNED NOT NULL,
  `reserved_at` int UNSIGNED DEFAULT NULL,
  `available_at` int UNSIGNED NOT NULL,
  `created_at` int UNSIGNED NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Cấu trúc bảng cho bảng `job_batches`
--

CREATE TABLE `job_batches` (
  `id` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `name` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `total_jobs` int NOT NULL,
  `pending_jobs` int NOT NULL,
  `failed_jobs` int NOT NULL,
  `failed_job_ids` longtext COLLATE utf8mb4_unicode_ci NOT NULL,
  `options` mediumtext COLLATE utf8mb4_unicode_ci,
  `cancelled_at` int DEFAULT NULL,
  `created_at` int NOT NULL,
  `finished_at` int DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Cấu trúc bảng cho bảng `migrations`
--

CREATE TABLE `migrations` (
  `id` int UNSIGNED NOT NULL,
  `migration` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `batch` int NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Đang đổ dữ liệu cho bảng `migrations`
--

INSERT INTO `migrations` (`id`, `migration`, `batch`) VALUES
(1, '0001_01_01_000000_create_users_table', 1),
(2, '0001_01_01_000001_create_cache_table', 1),
(3, '0001_01_01_000002_create_jobs_table', 1),
(4, '2026_07_11_203936_create_personal_access_tokens_table', 1),
(5, '2026_07_12_000001_create_ptt_tables', 1),
(6, '2026_07_12_000002_add_phone_and_address_to_users_table', 1),
(7, '2026_07_12_173905_add_onchain_round_id_to_funding_rounds', 1),
(8, '2026_07_12_175017_add_payment_token_fields_to_funding_rounds', 1),
(9, '2026_07_12_182649_add_is_blacklisted_to_users_table', 1);

-- --------------------------------------------------------

--
-- Cấu trúc bảng cho bảng `orders`
--

CREATE TABLE `orders` (
  `id` bigint UNSIGNED NOT NULL,
  `company_id` bigint UNSIGNED NOT NULL,
  `user_address` varchar(42) COLLATE utf8mb4_unicode_ci NOT NULL,
  `side` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `price` decimal(24,4) NOT NULL,
  `amount` decimal(24,4) NOT NULL,
  `filled_amount` decimal(24,4) NOT NULL DEFAULT '0.0000',
  `signature` text COLLATE utf8mb4_unicode_ci NOT NULL,
  `status` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'PENDING',
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Cấu trúc bảng cho bảng `password_reset_tokens`
--

CREATE TABLE `password_reset_tokens` (
  `email` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `token` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `created_at` timestamp NULL DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Cấu trúc bảng cho bảng `personal_access_tokens`
--

CREATE TABLE `personal_access_tokens` (
  `id` bigint UNSIGNED NOT NULL,
  `tokenable_type` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `tokenable_id` bigint UNSIGNED NOT NULL,
  `name` text COLLATE utf8mb4_unicode_ci NOT NULL,
  `token` varchar(64) COLLATE utf8mb4_unicode_ci NOT NULL,
  `abilities` text COLLATE utf8mb4_unicode_ci,
  `last_used_at` timestamp NULL DEFAULT NULL,
  `expires_at` timestamp NULL DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Đang đổ dữ liệu cho bảng `personal_access_tokens`
--

INSERT INTO `personal_access_tokens` (`id`, `tokenable_type`, `tokenable_id`, `name`, `token`, `abilities`, `last_used_at`, `expires_at`, `created_at`, `updated_at`) VALUES
(2, 'App\\Infrastructure\\Persistence\\Eloquent\\UserModel', 1, 'auth_token', 'e20986597ab00198c5561e594f844c8b6938669e20f59872c26ab9f0e2434c9f', '[\"*\"]', '2026-07-13 05:46:58', NULL, '2026-07-13 04:44:52', '2026-07-13 05:46:58');

-- --------------------------------------------------------

--
-- Cấu trúc bảng cho bảng `proposals`
--

CREATE TABLE `proposals` (
  `id` bigint UNSIGNED NOT NULL,
  `company_id` bigint UNSIGNED NOT NULL,
  `title` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `description` text COLLATE utf8mb4_unicode_ci,
  `type` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `params` json DEFAULT NULL,
  `status` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'DRAFT',
  `tx_hash` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `effective_date` timestamp NULL DEFAULT NULL,
  `expiration_date` timestamp NULL DEFAULT NULL,
  `created_by` bigint UNSIGNED NOT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Đang đổ dữ liệu cho bảng `proposals`
--

INSERT INTO `proposals` (`id`, `company_id`, `title`, `description`, `type`, `params`, `status`, `tx_hash`, `effective_date`, `expiration_date`, `created_by`, `created_at`, `updated_at`) VALUES
(1, 1, 'Mở vòng gọi vốn: Vòng Seed', 'Mở vòng gọi vốn Vòng Seed thanh toán bằng USDT. Giá 1 / Share, giới hạn chào bán 1000000 cổ phần.', 'FUNDING_ROUND', '{\"name\": \"Vòng Seed\", \"value\": \"0\", \"target\": \"0xA8E7f662Ea604174379BAB0a611300c255b512CA\", \"calldata\": \"0x70fb23c100000000000000000000000000000000000000000000000000000000000000200000000000000000000000000000000000000000000000000000000000000160000000000000000000000000663fa9eeb64674c8c2747f46e01b4eb3c11137a3000000000000000000000000a0f2afaace4cb692ea9ff666d2ef7ab054a35407000000000000000000000000441510a37c3d2dcb82aafd96fed18631e817787e0000000000000000000000000000000000000000000000000de0b6b3a764000000000000000000000000000000000000000000000000d3c21bcecceda1000000000000000000000000000000000000000000000000000000000000006a54d05c000000000000000000000000000000000000000000000000000000006a7c5d5c000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000a56c3b26e67205365656400000000000000000000000000000000000000000000\", \"max_supply\": 1000000, \"onchain_id\": 1, \"share_price\": \"1\", \"duration_days\": 30, \"payment_token_symbol\": \"USDT\", \"payment_token_address\": \"0xa0f2afaace4cb692ea9ff666d2ef7ab054a35407\", \"payment_token_decimals\": 18}', 'EXECUTED', '0xec3f0bdf6f82dbeeaa5d5b43d217495ce452f7795b03fb652fa8c486ae3c0871', '2026-07-13 04:51:13', '2026-07-20 11:47:46', 1, '2026-07-13 04:47:47', '2026-07-13 04:51:13'),
(2, 1, 'Phát token', NULL, 'MINT', '{\"value\": \"0\", \"target\": \"0x663Fa9Eeb64674c8c2747f46E01B4Eb3c11137A3\", \"calldata\": \"0x40c10f19000000000000000000000000a8e7f662ea604174379bab0a611300c255b512ca00000000000000000000000000000000000000000000d3c21bcecceda1000000\", \"onchain_id\": 2}', 'EXECUTED', '0x78f1927de05db24b6b8288d60216ad60573bec020a9220d5203fadc97549196b', '2026-07-13 05:42:05', '2026-07-20 12:41:45', 1, '2026-07-13 05:41:46', '2026-07-13 05:42:05');

-- --------------------------------------------------------

--
-- Cấu trúc bảng cho bảng `proposal_signatures`
--

CREATE TABLE `proposal_signatures` (
  `id` bigint UNSIGNED NOT NULL,
  `proposal_id` bigint UNSIGNED NOT NULL,
  `wallet_address` varchar(42) COLLATE utf8mb4_unicode_ci NOT NULL,
  `signature` text COLLATE utf8mb4_unicode_ci NOT NULL,
  `status` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'SIGNED',
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Đang đổ dữ liệu cho bảng `proposal_signatures`
--

INSERT INTO `proposal_signatures` (`id`, `proposal_id`, `wallet_address`, `signature`, `status`, `created_at`, `updated_at`) VALUES
(1, 1, '0x75ad18ef47eda21baff837cac0f1563d0c355555', '0x5af0dea8f4f692638a6d5c19ef29da6030d986673577fcf430de2e981ba4395a11a80a3aedfc29a78c773e33875c41ca7c480fe6026623bb8cf1a356dac335851b', 'SIGNED', '2026-07-13 04:48:05', '2026-07-13 04:48:05'),
(2, 2, '0x75ad18ef47eda21baff837cac0f1563d0c355555', '0x671365c65d465d8e44913e63e843ac543a65cd298bd28f569d0097a2f72c255a354b8c62e51bba680cd3016e5b5ad9ee0fcec13eff6c93382701c863fceaf67e1b', 'SIGNED', '2026-07-13 05:41:49', '2026-07-13 05:41:49');

-- --------------------------------------------------------

--
-- Cấu trúc bảng cho bảng `roles`
--

CREATE TABLE `roles` (
  `id` bigint UNSIGNED NOT NULL,
  `company_id` bigint UNSIGNED DEFAULT NULL,
  `name` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `permissions` json NOT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Đang đổ dữ liệu cho bảng `roles`
--

INSERT INTO `roles` (`id`, `company_id`, `name`, `permissions`, `created_at`, `updated_at`) VALUES
(1, 1, 'Owner', '[\"*\"]', '2026-07-13 04:45:05', '2026-07-13 04:45:05'),
(2, 1, 'Board Member', '[\"staffs.view\", \"staffs.create\", \"staffs.edit\", \"proposals.view\", \"proposals.create\", \"proposals.sign\", \"funding.view\", \"dividends.view\", \"marketplace.view\"]', '2026-07-13 04:45:05', '2026-07-13 04:45:05');

-- --------------------------------------------------------

--
-- Cấu trúc bảng cho bảng `sessions`
--

CREATE TABLE `sessions` (
  `id` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `user_id` bigint UNSIGNED DEFAULT NULL,
  `ip_address` varchar(45) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `user_agent` text COLLATE utf8mb4_unicode_ci,
  `payload` longtext COLLATE utf8mb4_unicode_ci NOT NULL,
  `last_activity` int NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Cấu trúc bảng cho bảng `staffs`
--

CREATE TABLE `staffs` (
  `id` bigint UNSIGNED NOT NULL,
  `user_id` bigint UNSIGNED NOT NULL,
  `company_id` bigint UNSIGNED NOT NULL,
  `role_id` bigint UNSIGNED NOT NULL,
  `status` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'ACTIVE',
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Đang đổ dữ liệu cho bảng `staffs`
--

INSERT INTO `staffs` (`id`, `user_id`, `company_id`, `role_id`, `status`, `created_at`, `updated_at`) VALUES
(1, 1, 1, 1, 'ACTIVE', '2026-07-13 04:45:05', '2026-07-13 04:45:05');

-- --------------------------------------------------------

--
-- Cấu trúc bảng cho bảng `trades`
--

CREATE TABLE `trades` (
  `id` bigint UNSIGNED NOT NULL,
  `buy_order_id` bigint UNSIGNED NOT NULL,
  `sell_order_id` bigint UNSIGNED NOT NULL,
  `price` decimal(24,4) NOT NULL,
  `amount` decimal(24,4) NOT NULL,
  `tx_hash` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Cấu trúc bảng cho bảng `users`
--

CREATE TABLE `users` (
  `id` bigint UNSIGNED NOT NULL,
  `name` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `wallet_address` varchar(42) COLLATE utf8mb4_unicode_ci NOT NULL,
  `email` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `phone` varchar(20) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `address` varchar(500) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `email_verified_at` timestamp NULL DEFAULT NULL,
  `password` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `kyc_status` varchar(10) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'PENDING',
  `is_whitelisted` tinyint(1) NOT NULL DEFAULT '0',
  `is_blacklisted` tinyint(1) NOT NULL DEFAULT '0',
  `remember_token` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Đang đổ dữ liệu cho bảng `users`
--

INSERT INTO `users` (`id`, `name`, `wallet_address`, `email`, `phone`, `address`, `email_verified_at`, `password`, `kyc_status`, `is_whitelisted`, `is_blacklisted`, `remember_token`, `created_at`, `updated_at`) VALUES
(1, NULL, '0x75ad18ef47eda21baff837cac0f1563d0c355555', NULL, NULL, NULL, NULL, NULL, 'APPROVED', 1, 0, NULL, '2026-07-13 04:24:57', '2026-07-13 05:38:23'),
(2, NULL, '0xa8e7f662ea604174379bab0a611300c255b512ca', NULL, NULL, NULL, NULL, NULL, 'APPROVED', 1, 0, NULL, '2026-07-13 05:43:38', '2026-07-13 05:43:38');

--
-- Chỉ mục cho các bảng đã đổ
--

--
-- Chỉ mục cho bảng `audit_logs`
--
ALTER TABLE `audit_logs`
  ADD PRIMARY KEY (`id`);

--
-- Chỉ mục cho bảng `cache`
--
ALTER TABLE `cache`
  ADD PRIMARY KEY (`key`),
  ADD KEY `cache_expiration_index` (`expiration`);

--
-- Chỉ mục cho bảng `cache_locks`
--
ALTER TABLE `cache_locks`
  ADD PRIMARY KEY (`key`),
  ADD KEY `cache_locks_expiration_index` (`expiration`);

--
-- Chỉ mục cho bảng `companies`
--
ALTER TABLE `companies`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `companies_uuid_unique` (`uuid`),
  ADD UNIQUE KEY `companies_code_unique` (`code`);

--
-- Chỉ mục cho bảng `dividends`
--
ALTER TABLE `dividends`
  ADD PRIMARY KEY (`id`),
  ADD KEY `dividends_company_id_foreign` (`company_id`);

--
-- Chỉ mục cho bảng `failed_jobs`
--
ALTER TABLE `failed_jobs`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `failed_jobs_uuid_unique` (`uuid`),
  ADD KEY `failed_jobs_connection_queue_failed_at_index` (`connection`,`queue`,`failed_at`);

--
-- Chỉ mục cho bảng `funding_rounds`
--
ALTER TABLE `funding_rounds`
  ADD PRIMARY KEY (`id`),
  ADD KEY `funding_rounds_company_id_foreign` (`company_id`);

--
-- Chỉ mục cho bảng `jobs`
--
ALTER TABLE `jobs`
  ADD PRIMARY KEY (`id`),
  ADD KEY `jobs_queue_index` (`queue`);

--
-- Chỉ mục cho bảng `job_batches`
--
ALTER TABLE `job_batches`
  ADD PRIMARY KEY (`id`);

--
-- Chỉ mục cho bảng `migrations`
--
ALTER TABLE `migrations`
  ADD PRIMARY KEY (`id`);

--
-- Chỉ mục cho bảng `orders`
--
ALTER TABLE `orders`
  ADD PRIMARY KEY (`id`),
  ADD KEY `orders_company_id_side_status_index` (`company_id`,`side`,`status`);

--
-- Chỉ mục cho bảng `password_reset_tokens`
--
ALTER TABLE `password_reset_tokens`
  ADD PRIMARY KEY (`email`);

--
-- Chỉ mục cho bảng `personal_access_tokens`
--
ALTER TABLE `personal_access_tokens`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `personal_access_tokens_token_unique` (`token`),
  ADD KEY `personal_access_tokens_tokenable_type_tokenable_id_index` (`tokenable_type`,`tokenable_id`),
  ADD KEY `personal_access_tokens_expires_at_index` (`expires_at`);

--
-- Chỉ mục cho bảng `proposals`
--
ALTER TABLE `proposals`
  ADD PRIMARY KEY (`id`),
  ADD KEY `proposals_created_by_foreign` (`created_by`),
  ADD KEY `proposals_company_id_status_index` (`company_id`,`status`);

--
-- Chỉ mục cho bảng `proposal_signatures`
--
ALTER TABLE `proposal_signatures`
  ADD PRIMARY KEY (`id`),
  ADD KEY `proposal_signatures_proposal_id_foreign` (`proposal_id`);

--
-- Chỉ mục cho bảng `roles`
--
ALTER TABLE `roles`
  ADD PRIMARY KEY (`id`),
  ADD KEY `roles_company_id_foreign` (`company_id`);

--
-- Chỉ mục cho bảng `sessions`
--
ALTER TABLE `sessions`
  ADD PRIMARY KEY (`id`),
  ADD KEY `sessions_user_id_index` (`user_id`),
  ADD KEY `sessions_last_activity_index` (`last_activity`);

--
-- Chỉ mục cho bảng `staffs`
--
ALTER TABLE `staffs`
  ADD PRIMARY KEY (`id`),
  ADD KEY `staffs_user_id_foreign` (`user_id`),
  ADD KEY `staffs_company_id_foreign` (`company_id`),
  ADD KEY `staffs_role_id_foreign` (`role_id`);

--
-- Chỉ mục cho bảng `trades`
--
ALTER TABLE `trades`
  ADD PRIMARY KEY (`id`),
  ADD KEY `trades_buy_order_id_foreign` (`buy_order_id`),
  ADD KEY `trades_sell_order_id_foreign` (`sell_order_id`),
  ADD KEY `trades_tx_hash_index` (`tx_hash`);

--
-- Chỉ mục cho bảng `users`
--
ALTER TABLE `users`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `users_wallet_address_unique` (`wallet_address`);

--
-- AUTO_INCREMENT cho các bảng đã đổ
--

--
-- AUTO_INCREMENT cho bảng `audit_logs`
--
ALTER TABLE `audit_logs`
  MODIFY `id` bigint UNSIGNED NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT cho bảng `companies`
--
ALTER TABLE `companies`
  MODIFY `id` bigint UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=2;

--
-- AUTO_INCREMENT cho bảng `dividends`
--
ALTER TABLE `dividends`
  MODIFY `id` bigint UNSIGNED NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT cho bảng `failed_jobs`
--
ALTER TABLE `failed_jobs`
  MODIFY `id` bigint UNSIGNED NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT cho bảng `funding_rounds`
--
ALTER TABLE `funding_rounds`
  MODIFY `id` bigint UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=3;

--
-- AUTO_INCREMENT cho bảng `jobs`
--
ALTER TABLE `jobs`
  MODIFY `id` bigint UNSIGNED NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT cho bảng `migrations`
--
ALTER TABLE `migrations`
  MODIFY `id` int UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=10;

--
-- AUTO_INCREMENT cho bảng `orders`
--
ALTER TABLE `orders`
  MODIFY `id` bigint UNSIGNED NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT cho bảng `personal_access_tokens`
--
ALTER TABLE `personal_access_tokens`
  MODIFY `id` bigint UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=3;

--
-- AUTO_INCREMENT cho bảng `proposals`
--
ALTER TABLE `proposals`
  MODIFY `id` bigint UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=3;

--
-- AUTO_INCREMENT cho bảng `proposal_signatures`
--
ALTER TABLE `proposal_signatures`
  MODIFY `id` bigint UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=3;

--
-- AUTO_INCREMENT cho bảng `roles`
--
ALTER TABLE `roles`
  MODIFY `id` bigint UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=3;

--
-- AUTO_INCREMENT cho bảng `staffs`
--
ALTER TABLE `staffs`
  MODIFY `id` bigint UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=2;

--
-- AUTO_INCREMENT cho bảng `trades`
--
ALTER TABLE `trades`
  MODIFY `id` bigint UNSIGNED NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT cho bảng `users`
--
ALTER TABLE `users`
  MODIFY `id` bigint UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=3;

--
-- Ràng buộc đối với các bảng kết xuất
--

--
-- Ràng buộc cho bảng `dividends`
--
ALTER TABLE `dividends`
  ADD CONSTRAINT `dividends_company_id_foreign` FOREIGN KEY (`company_id`) REFERENCES `companies` (`id`) ON DELETE CASCADE;

--
-- Ràng buộc cho bảng `funding_rounds`
--
ALTER TABLE `funding_rounds`
  ADD CONSTRAINT `funding_rounds_company_id_foreign` FOREIGN KEY (`company_id`) REFERENCES `companies` (`id`) ON DELETE CASCADE;

--
-- Ràng buộc cho bảng `orders`
--
ALTER TABLE `orders`
  ADD CONSTRAINT `orders_company_id_foreign` FOREIGN KEY (`company_id`) REFERENCES `companies` (`id`) ON DELETE CASCADE;

--
-- Ràng buộc cho bảng `proposals`
--
ALTER TABLE `proposals`
  ADD CONSTRAINT `proposals_company_id_foreign` FOREIGN KEY (`company_id`) REFERENCES `companies` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `proposals_created_by_foreign` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`) ON DELETE CASCADE;

--
-- Ràng buộc cho bảng `proposal_signatures`
--
ALTER TABLE `proposal_signatures`
  ADD CONSTRAINT `proposal_signatures_proposal_id_foreign` FOREIGN KEY (`proposal_id`) REFERENCES `proposals` (`id`) ON DELETE CASCADE;

--
-- Ràng buộc cho bảng `roles`
--
ALTER TABLE `roles`
  ADD CONSTRAINT `roles_company_id_foreign` FOREIGN KEY (`company_id`) REFERENCES `companies` (`id`) ON DELETE CASCADE;

--
-- Ràng buộc cho bảng `staffs`
--
ALTER TABLE `staffs`
  ADD CONSTRAINT `staffs_company_id_foreign` FOREIGN KEY (`company_id`) REFERENCES `companies` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `staffs_role_id_foreign` FOREIGN KEY (`role_id`) REFERENCES `roles` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `staffs_user_id_foreign` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE;

--
-- Ràng buộc cho bảng `trades`
--
ALTER TABLE `trades`
  ADD CONSTRAINT `trades_buy_order_id_foreign` FOREIGN KEY (`buy_order_id`) REFERENCES `orders` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `trades_sell_order_id_foreign` FOREIGN KEY (`sell_order_id`) REFERENCES `orders` (`id`) ON DELETE CASCADE;
COMMIT;

/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
