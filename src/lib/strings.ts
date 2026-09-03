/**
 * Centralized string constants for better maintainability and i18n support
 * 
 * This module contains all hardcoded strings used throughout the application,
 * making it easier to:
 * - Maintain consistency across the codebase
 * - Support internationalization (i18n) in the future
 * - Update messages and labels from a single location
 */

// API Routes
export const API_ROUTES = {
  BEVERAGES: "/api/beverages",
} as const;

// SQL Queries
export const SQL_QUERIES = {
  SELECT_CUSTOMERS_BY_COMPANY: "SELECT CustomerId, CompanyName, ContactName FROM Customers WHERE CompanyName = ?",
} as const;

// Company Data
export const COMPANY_NAMES = {
  BS_BEVERAGES: "Bs Beverages",
} as const;

// HTTP Headers
export const HTTP_HEADERS = {
  CACHE_CONTROL_PUBLIC_60S: "public, max-age=60",
} as const;

// Error Messages
export const ERROR_MESSAGES = {
  DATABASE_QUERY_FAILED: "Database query failed:",
  FAILED_TO_FETCH_BEVERAGES: "Failed to fetch beverages data",
} as const;

// Response Messages
export const RESPONSE_MESSAGES = {
  DEFAULT_MESSAGE: "Call /api/beverages to see everyone who works at Bs Beverages",
} as const;
