-- phpMyAdmin SQL Dump
-- version 5.2.2
-- https://www.phpmyadmin.net/
--
-- Máy chủ: localhost:3306
-- Thời gian đã tạo: Th7 20, 2026 lúc 11:16 AM
-- Phiên bản máy phục vụ: 8.0.30
-- Phiên bản PHP: 8.3.8

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
('ptt-dapp-cache-0f0b38171dd4add1c3cffb4494bce6e5', 'i:2;', 1784054438),
('ptt-dapp-cache-0f0b38171dd4add1c3cffb4494bce6e5:timer', 'i:1784054438;', 1784054438),
('ptt-dapp-cache-1e022360f51181e93c1dd9f9d5e81356', 'i:2;', 1784121317),
('ptt-dapp-cache-1e022360f51181e93c1dd9f9d5e81356:timer', 'i:1784121317;', 1784121317),
('ptt-dapp-cache-4fc5e9f78f94663a9466d9c91e0ef958', 'i:2;', 1784121282),
('ptt-dapp-cache-4fc5e9f78f94663a9466d9c91e0ef958:timer', 'i:1784121282;', 1784121282),
('ptt-dapp-cache-a3affa0d1e1a3c72b78aa984c3367a05', 'i:2;', 1784056432),
('ptt-dapp-cache-a3affa0d1e1a3c72b78aa984c3367a05:timer', 'i:1784056432;', 1784056432),
('ptt-dapp-cache-a75f3f172bfb296f2e10cbfc6dfc1883', 'i:1;', 1784121334),
('ptt-dapp-cache-a75f3f172bfb296f2e10cbfc6dfc1883:timer', 'i:1784121334;', 1784121334),
('ptt-dapp-cache-e9b6cc1432541b9ceebf113eee05eeba', 'i:2;', 1784121322),
('ptt-dapp-cache-e9b6cc1432541b9ceebf113eee05eeba:timer', 'i:1784121322;', 1784121322),
('ptt-dapp-cache-f1f70ec40aaa556905d4a030501c0ba4', 'i:1;', 1784121316),
('ptt-dapp-cache-f1f70ec40aaa556905d4a030501c0ba4:timer', 'i:1784121316;', 1784121316);

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
  `token_name` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `token_symbol` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `saved_tokens` json DEFAULT NULL,
  `logo` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `valuation` decimal(24,4) NOT NULL DEFAULT '0.0000',
  `chain_id` int UNSIGNED DEFAULT NULL,
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

INSERT INTO `companies` (`id`, `uuid`, `code`, `name`, `token_name`, `token_symbol`, `saved_tokens`, `logo`, `valuation`, `chain_id`, `governance_address`, `token_address`, `funding_address`, `marketplace_address`, `status`, `created_at`, `updated_at`) VALUES
(1, '019f60a6-94e1-7198-be4c-599da735d0fc', 'PTT', 'CTCP Tài Sản Số PTT', NULL, NULL, '[{\"name\": \"USDT Token\", \"symbol\": \"USDT\", \"address\": \"0xa0f2AfaACe4cB692Ea9FF666d2eF7AB054a35407\", \"decimals\": 18}]', NULL, 1000000.0000, 97, '0x7a05363200625b74407ad85B4b01FE3B7064bbD6', '0x1A7da989f32EDDfdE7d0a929faE0CEf68b228b79', '0xbda016EfeAB0eb0e244801232d1EB4e776e8D5ED', '0x368B5e59ec6460c6F493fdC7Fe78ab859584B110', 'ACTIVE', '2026-07-14 05:42:37', '2026-07-14 05:45:20');

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

--
-- Đang đổ dữ liệu cho bảng `dividends`
--

INSERT INTO `dividends` (`id`, `company_id`, `reward_token_address`, `total_amount`, `snapshot_block`, `payment_date`, `status`, `created_at`, `updated_at`) VALUES
(1, 1, '0xa0f2AfaACe4cB692Ea9FF666d2eF7AB054a35407', 50.0000, 119086125, '2026-07-13 17:00:00', 'DRAFT', '2026-07-14 05:54:57', '2026-07-14 05:54:57'),
(2, 1, '0xa0f2AfaACe4cB692Ea9FF666d2eF7AB054a35407', 50.0000, 119098732, '2026-07-13 17:00:00', 'ACTIVE', '2026-07-14 07:30:32', '2026-07-14 07:31:06');

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
(1, 1, 'Vòng Seed', 1.0000, '0xa0f2AfaACe4cB692Ea9FF666d2eF7AB054a35407', 'USDT', 18, 100000.0000, 16.0000, '2026-07-14 05:47:16', '2026-08-13 05:47:16', 'ACTIVE', 1, '2026-07-14 05:46:32', '2026-07-14 05:53:25'),
(2, 1, 'Vòng Seed', 1.0000, '0xa0f2AfaACe4cB692Ea9FF666d2eF7AB054a35407', 'USDT', 18, 1000000.0000, 110.0000, '2026-07-14 07:25:57', '2026-08-13 07:25:57', 'ACTIVE', 2, '2026-07-14 07:25:15', '2026-07-14 07:39:09');

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
(9, '2026_07_12_182649_add_is_blacklisted_to_users_table', 1),
(10, '2026_07_13_145538_add_token_name_and_symbol_to_companies_table', 1),
(11, '2026_07_13_150346_add_payment_token_to_orders_and_trades_tables', 1),
(12, '2026_07_14_061619_add_chain_id_to_companies_table', 1),
(13, '2026_07_14_084352_add_saved_tokens_to_companies_table', 1);

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
  `payment_token_address` varchar(42) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `payment_token_symbol` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'USDT',
  `filled_amount` decimal(24,4) NOT NULL DEFAULT '0.0000',
  `signature` text COLLATE utf8mb4_unicode_ci NOT NULL,
  `status` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'PENDING',
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Đang đổ dữ liệu cho bảng `orders`
--

INSERT INTO `orders` (`id`, `company_id`, `user_address`, `side`, `price`, `amount`, `payment_token_address`, `payment_token_symbol`, `filled_amount`, `signature`, `status`, `created_at`, `updated_at`) VALUES
(1, 1, '0xc0f810364e0eacebbd9e02187fd6504df4599999', 'BUY', 10.0000, 1.0000, '0xa0f2AfaACe4cB692Ea9FF666d2eF7AB054a35407', 'USDT', 0.0000, '0x8a14a44f18d953d81cfbb7a769e0f08947ffa730b47131c55dbd341e7271ca84217f65228331d367b3833b2f76336627c19ebaef8737848de820c648a2d0174b1b_1784040479960_1815576479', 'PENDING', '2026-07-14 07:48:10', '2026-07-14 07:48:10');

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
(9, 'App\\Infrastructure\\Persistence\\Eloquent\\UserModel', 4, 'auth_token', '7862ba024c22a9b07f7469fd5f6e9793f5ffb1c9abaf0346d0acd4e0751e5a03', '[\"*\"]', '2026-07-14 12:13:47', NULL, '2026-07-14 11:40:31', '2026-07-14 12:13:47'),
(10, 'App\\Infrastructure\\Persistence\\Eloquent\\UserModel', 1, 'auth_token', '411f462b6cd5216256011a16de80d26aced5c4347f0e3e32d7018b0fcf4f8d63', '[\"*\"]', '2026-07-14 12:13:48', NULL, '2026-07-14 12:11:15', '2026-07-14 12:13:48'),
(12, 'App\\Infrastructure\\Persistence\\Eloquent\\UserModel', 2, 'auth_token', 'daeb446f6443ae4742acd3998d32945a9b83f3a720869b1bd082cfa856439ac9', '[\"*\"]', '2026-07-15 06:15:14', NULL, '2026-07-15 06:15:10', '2026-07-15 06:15:14');

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
(1, 1, 'Thêm thành viên mới', 'Thêm thành viên vào HĐQT', 'ADD_MEMBER', '{\"value\": \"0\", \"target\": \"0x7a05363200625b74407ad85B4b01FE3B7064bbD6\", \"calldata\": \"0xca6d56dc000000000000000000000000c0f810364e0eacebbd9e02187fd6504df4599999\", \"onchain_id\": 1, \"member_address\": \"0xc0f810364e0eacEbbD9e02187fd6504dF4599999\"}', 'EXECUTED', '0xf1ec4a1a706123017e3607a98a82d1301879b60b7b117a502bc6a4e78f2730d1', '2026-07-14 05:44:27', '2026-07-21 12:44:06', 1, '2026-07-14 05:44:07', '2026-07-14 05:44:27'),
(2, 1, 'Mở vòng gọi vốn: Vòng Seed', 'Mở vòng gọi vốn Vòng Seed thanh toán bằng USDT. Giá 1 / Share, giới hạn chào bán 100000 cổ phần.', 'FUNDING_ROUND', '{\"name\": \"Vòng Seed\", \"value\": \"0\", \"target\": \"0xbda016EfeAB0eb0e244801232d1EB4e776e8D5ED\", \"calldata\": \"0x70fb23c1000000000000000000000000000000000000000000000000000000000000002000000000000000000000000000000000000000000000000000000000000001600000000000000000000000001a7da989f32eddfde7d0a929fae0cef68b228b79000000000000000000000000a0f2afaace4cb692ea9ff666d2ef7ab054a354070000000000000000000000007a05363200625b74407ad85b4b01fe3b7064bbd60000000000000000000000000000000000000000000000000de0b6b3a764000000000000000000000000000000000000000000000000152d02c7e14af6800000000000000000000000000000000000000000000000000000000000006a562f9d000000000000000000000000000000000000000000000000000000006a7dbc9d000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000a56c3b26e67205365656400000000000000000000000000000000000000000000\", \"max_supply\": 100000, \"onchain_id\": 2, \"share_price\": \"1\", \"duration_days\": 30, \"payment_token_symbol\": \"USDT\", \"payment_token_address\": \"0xa0f2AfaACe4cB692Ea9FF666d2eF7AB054a35407\", \"payment_token_decimals\": 18}', 'EXECUTED', '0x04dced53fbaf52b4bd0bf80556e655b72366ada38b7cd01d6b14c395caf0cc65', '2026-07-14 05:47:16', '2026-07-21 12:46:30', 1, '2026-07-14 05:46:31', '2026-07-14 05:47:16'),
(3, 1, 'Chia cổ tức: Chia cổ tức', 'Đợt chia cổ tức Chia cổ tức với tổng số tiền 50 USDT dựa trên tỷ lệ sở hữu tại Block #119086125.', 'DIVIDEND_ROUND', '{\"name\": \"Chia cổ tức\", \"value\": \"0\", \"target\": \"0xbda016EfeAB0eb0e244801232d1EB4e776e8D5ED\", \"calldata\": \"0x748e397600000000000000000000000000000000000000000000000000000000000000e00000000000000000000000001a7da989f32eddfde7d0a929fae0cef68b228b79000000000000000000000000a0f2afaace4cb692ea9ff666d2ef7ab054a35407000000000000000000000000000000000000000000000002b5e3af16b18800000000000000000000000000000000000000000000000000000000000007191c2d000000000000000000000000000000000000000000000000000000006a56319a000000000000000000000000000000000000000000000000000000006a7dbe9a000000000000000000000000000000000000000000000000000000000000000f436869612063e1bb952074e1bba9630000000000000000000000000000000000\", \"onchain_id\": 3, \"total_amount\": 50, \"dividend_db_id\": 1, \"snapshot_block\": 119086125, \"reward_token_address\": \"0xa0f2AfaACe4cB692Ea9FF666d2eF7AB054a35407\"}', 'EXECUTED', '0x0359afcd1da98aa0b16adaa2d85ea5046829ce3bb674c9bad1485552968b1689', '2026-07-14 05:55:28', '2026-07-21 12:54:57', 2, '2026-07-14 05:54:59', '2026-07-14 05:55:28'),
(4, 1, 'Thêm HĐQT mới', NULL, 'ADD_MEMBER', '{\"value\": \"0\", \"target\": \"0x7a05363200625b74407ad85B4b01FE3B7064bbD6\", \"calldata\": \"0xca6d56dc00000000000000000000000042863a74164440f3384ca82394e891bdb9888888\", \"onchain_id\": 4, \"member_address\": \"0x42863a74164440f3384cA82394e891bDb9888888\"}', 'EXECUTED', '0x5e4990232173117e322d51071c44970db6a75a66b8d4bc257dedb3a9d15d9f92', '2026-07-14 07:23:18', '2026-07-21 14:22:29', 2, '2026-07-14 07:22:31', '2026-07-14 07:23:18'),
(5, 1, 'Mở vòng gọi vốn: Vòng Seed', 'Mở vòng gọi vốn Vòng Seed thanh toán bằng USDT. Giá 1 / Share, giới hạn chào bán 1000000 cổ phần.', 'FUNDING_ROUND', '{\"name\": \"Vòng Seed\", \"value\": \"0\", \"target\": \"0xbda016EfeAB0eb0e244801232d1EB4e776e8D5ED\", \"calldata\": \"0x70fb23c1000000000000000000000000000000000000000000000000000000000000002000000000000000000000000000000000000000000000000000000000000001600000000000000000000000001a7da989f32eddfde7d0a929fae0cef68b228b79000000000000000000000000a0f2afaace4cb692ea9ff666d2ef7ab054a354070000000000000000000000007a05363200625b74407ad85b4b01fe3b7064bbd60000000000000000000000000000000000000000000000000de0b6b3a764000000000000000000000000000000000000000000000000d3c21bcecceda1000000000000000000000000000000000000000000000000000000000000006a5646be000000000000000000000000000000000000000000000000000000006a7dd3be000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000a56c3b26e67205365656400000000000000000000000000000000000000000000\", \"max_supply\": 1000000, \"onchain_id\": 5, \"share_price\": \"1\", \"duration_days\": 30, \"payment_token_symbol\": \"USDT\", \"payment_token_address\": \"0xa0f2AfaACe4cB692Ea9FF666d2eF7AB054a35407\", \"payment_token_decimals\": 18}', 'EXECUTED', '0x532986481709348619a1654d5cca311f96eccbb16b0100edcd3239c2c8787804', '2026-07-14 07:25:57', '2026-07-21 14:25:13', 2, '2026-07-14 07:25:14', '2026-07-14 07:25:57'),
(6, 1, 'Chia cổ tức: Chia cổ tức', 'Đợt chia cổ tức Chia cổ tức với tổng số tiền 50 USDT dựa trên tỷ lệ sở hữu tại Block #119098732.', 'DIVIDEND_ROUND', '{\"name\": \"Chia cổ tức\", \"value\": \"0\", \"target\": \"0xbda016EfeAB0eb0e244801232d1EB4e776e8D5ED\", \"calldata\": \"0x748e397600000000000000000000000000000000000000000000000000000000000000e00000000000000000000000001a7da989f32eddfde7d0a929fae0cef68b228b79000000000000000000000000a0f2afaace4cb692ea9ff666d2ef7ab054a35407000000000000000000000000000000000000000000000002b5e3af16b18800000000000000000000000000000000000000000000000000000000000007194d6c000000000000000000000000000000000000000000000000000000006a5647f6000000000000000000000000000000000000000000000000000000006a7dd4f6000000000000000000000000000000000000000000000000000000000000000f436869612063e1bb952074e1bba9630000000000000000000000000000000000\", \"onchain_id\": 6, \"total_amount\": 50, \"dividend_db_id\": 2, \"snapshot_block\": 119098732, \"reward_token_address\": \"0xa0f2AfaACe4cB692Ea9FF666d2eF7AB054a35407\"}', 'EXECUTED', '0x43e22eaf1ea992152b278bab6f0dbf199dccf78d6aae2b5b70a1d5a5cb3d69a5', '2026-07-14 07:31:04', '2026-07-21 14:30:32', 2, '2026-07-14 07:30:33', '2026-07-14 07:31:04'),
(7, 1, 'Rút tiền do chuyển nhầm', NULL, 'WITHDRAW_ERC20', '{\"value\": \"0\", \"target\": \"0x1A7da989f32EDDfdE7d0a929faE0CEf68b228b79\", \"calldata\": \"0xb2118a8d000000000000000000000000a0f2afaace4cb692ea9ff666d2ef7ab054a3540700000000000000000000000075ad18ef47eda21baff837cac0f1563d0c3555550000000000000000000000000000000000000000000000000de0b6b3a7640000\", \"onchain_id\": 7}', 'EXECUTED', '0x594399fcbde87605cb5f6879b3a2ce6de09a7f51ec9b185274dadd71cf9b54c4', '2026-07-14 11:27:44', '2026-07-21 18:26:53', 2, '2026-07-14 11:26:54', '2026-07-14 11:27:44');

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
(1, 1, '0x75ad18ef47eda21baff837cac0f1563d0c355555', '0xa2e35849fe02d549942597e9c81fed3714fcb9b1c1f628e1686feec1bdea4ccf209696539bdd40a9c4b2491594c29a46b6e3d8dd596d8d5558c49de7b7b9e14a1c', 'SIGNED', '2026-07-14 05:44:10', '2026-07-14 05:44:10'),
(2, 2, '0x75ad18ef47eda21baff837cac0f1563d0c355555', '0xf73994ccd56bd0aac137e9661eadd9c65e76f529c290af1532082f0ad08e46df174da69734d29d0d0aaa1019ab25d61d43e3d8f1729e36a1f960887dc9484c141c', 'SIGNED', '2026-07-14 05:46:46', '2026-07-14 05:46:46'),
(3, 3, '0xc0f810364e0eacebbd9e02187fd6504df4599999', '0xcaf7c2f0c3df6352bae750a1ed4b8dd4f708a75dad9686d4b91ed08bffb0cdbe20c4c1f98bd98e04ad8ee2da12ba8ab4fb86ff3313cf3714fc6b2c3abc6bbbfd1c', 'SIGNED', '2026-07-14 05:55:11', '2026-07-14 05:55:11'),
(4, 4, '0xc0f810364e0eacebbd9e02187fd6504df4599999', '0xe00cca12b64d60c6cfe5eef5640e602ae5716f889af125159e2e9f61f3e13a4a38224596879b09586b09cce6b93761e695cb546985bad1a6154b40aededdcfdb1c', 'SIGNED', '2026-07-14 07:22:36', '2026-07-14 07:22:36'),
(5, 5, '0xc0f810364e0eacebbd9e02187fd6504df4599999', '0xe356ed457e765f2ca44303b3afc77bc35981fdb6b2ed1c242006b8d8c209bd85771f6d577b282ce37e0ec1e14586b29c752d6e028eeb3282e51338f1b130be8e1c', 'SIGNED', '2026-07-14 07:25:39', '2026-07-14 07:25:39'),
(6, 6, '0xc0f810364e0eacebbd9e02187fd6504df4599999', '0x55c81e118ae3156468ff7a4f35387911a3f9da18cf4f6febccda8a60cee4e3d1320e5011df1957ce517f3bd5a97157ed14bf826813963d8fee9adc2fed8f4cde1b', 'SIGNED', '2026-07-14 07:30:53', '2026-07-14 07:30:53'),
(7, 7, '0xc0f810364e0eacebbd9e02187fd6504df4599999', '0x0ff4c0eb2413e91b3be064f7e4e1e1e3616389f1c8e6cbea088ad12ecbd762f05b944f43e5cda061c35cbfe19383c03119107908a110861c442e50d0e85202521b', 'SIGNED', '2026-07-14 11:26:57', '2026-07-14 11:26:57');

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
(1, 1, 'Owner', '[\"*\"]', '2026-07-14 05:42:37', '2026-07-14 05:42:37'),
(2, 1, 'Board Member', '[\"staffs.view\", \"staffs.create\", \"staffs.edit\", \"proposals.view\", \"proposals.create\", \"proposals.sign\", \"funding.view\", \"dividends.view\", \"marketplace.view\"]', '2026-07-14 05:42:37', '2026-07-14 05:42:37');

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
(1, 1, 1, 1, 'ACTIVE', '2026-07-14 05:42:37', '2026-07-14 05:42:37'),
(2, 2, 1, 1, 'ACTIVE', '2026-07-14 05:44:27', '2026-07-15 06:15:14'),
(3, 3, 1, 1, 'ACTIVE', '2026-07-14 07:23:18', '2026-07-15 06:15:14');

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
  `payment_token_address` varchar(42) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `payment_token_symbol` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'USDT',
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
(1, NULL, '0x75ad18ef47eda21baff837cac0f1563d0c355555', NULL, NULL, NULL, NULL, NULL, 'APPROVED', 0, 0, NULL, '2026-07-14 05:42:14', '2026-07-14 05:47:57'),
(2, 'User-599999', '0xc0f810364e0eacebbd9e02187fd6504df4599999', 'user-599999@ptt-web3.com', NULL, NULL, NULL, NULL, 'APPROVED', 0, 0, NULL, '2026-07-14 05:44:27', '2026-07-14 05:47:46'),
(3, 'User-888888', '0x42863a74164440f3384ca82394e891bdb9888888', 'user-888888@ptt-web3.com', NULL, NULL, NULL, NULL, 'APPROVED', 0, 0, NULL, '2026-07-14 07:23:18', '2026-07-14 08:04:00'),
(4, NULL, '0x1ad11e0e96797a14336bf474676eb0a332055555', NULL, NULL, NULL, NULL, NULL, 'APPROVED', 1, 0, NULL, '2026-07-14 11:32:29', '2026-07-14 11:32:29');

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
  MODIFY `id` bigint UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=3;

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
  MODIFY `id` int UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=14;

--
-- AUTO_INCREMENT cho bảng `orders`
--
ALTER TABLE `orders`
  MODIFY `id` bigint UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=2;

--
-- AUTO_INCREMENT cho bảng `personal_access_tokens`
--
ALTER TABLE `personal_access_tokens`
  MODIFY `id` bigint UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=13;

--
-- AUTO_INCREMENT cho bảng `proposals`
--
ALTER TABLE `proposals`
  MODIFY `id` bigint UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=8;

--
-- AUTO_INCREMENT cho bảng `proposal_signatures`
--
ALTER TABLE `proposal_signatures`
  MODIFY `id` bigint UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=8;

--
-- AUTO_INCREMENT cho bảng `roles`
--
ALTER TABLE `roles`
  MODIFY `id` bigint UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=3;

--
-- AUTO_INCREMENT cho bảng `staffs`
--
ALTER TABLE `staffs`
  MODIFY `id` bigint UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=4;

--
-- AUTO_INCREMENT cho bảng `trades`
--
ALTER TABLE `trades`
  MODIFY `id` bigint UNSIGNED NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT cho bảng `users`
--
ALTER TABLE `users`
  MODIFY `id` bigint UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=5;

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
