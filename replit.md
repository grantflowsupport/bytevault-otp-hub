# ByteVault OTP Hub — Multi-Product OTP Gateway

## Overview

ByteVault OTP Hub is a production-ready multi-product OTP (One-Time Password) gateway system that allows users to securely retrieve authentication codes from multiple email accounts across different products. The system provides a centralized portal where users can access granted products, view shared credentials, and fetch OTPs from mapped email inboxes with unlimited requests while access is valid.

The application features a comprehensive admin panel for managing products, email accounts (IMAP inboxes), product-account mappings, credentials, and user access controls with expiry dates. It supports any IMAP provider including Gmail, Outlook/O365, Zoho, Proton (paid IMAP), and custom domain mailboxes.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture
- **Framework**: React with Vite for fast development and optimized builds
- **UI Components**: shadcn/ui component library built on Radix UI primitives
- **Styling**: Tailwind CSS with CSS variables for theming
- **State Management**: TanStack Query (React Query) for server state management
- **Routing**: Wouter for lightweight client-side routing
- **Authentication**: Supabase Auth integration with session management

### Backend Architecture
- **Runtime**: Node.js with Express.js framework
- **Language**: TypeScript with ES modules
- **API Structure**: RESTful endpoints with role-based access control
- **Authentication Middleware**: Bearer token validation with admin role checking
- **Rate Limiting**: In-memory rate limiting for OTP requests (10 requests per minute per user-product)
- **Email Processing**: IMAP integration using imapflow and mailparser for OTP extraction

### Database & Authentication
- **Primary Database**: Supabase (PostgreSQL) with Row Level Security (RLS) enabled
- **Schema Management**: Drizzle ORM with PostgreSQL dialect
- **Authentication Provider**: Supabase Auth with email/password authentication
- **Access Control**: Service role for server-side operations, anon key for client operations

### Security Architecture
- **Encryption**: AES-256-GCM for IMAP password encryption at rest
- **Key Management**: SHA-256 derived keys from environment secrets
- **Token Security**: Service role key never exposed to client
- **Data Protection**: All sensitive IMAP credentials encrypted before storage

### Data Models
- **Products**: Slugged products with titles, descriptions, and active status
- **Accounts**: IMAP configurations with encrypted passwords and OTP regex patterns
- **Product-Account Mappings**: Many-to-many relationships with weight-based prioritization
- **Product Credentials**: User-visible login information per product
- **User Access**: Time-bound access grants with expiration dates
- **OTP Logs**: Audit trail for all OTP requests and outcomes

### Email Integration Architecture
- **IMAP Support**: Universal IMAP compatibility with configurable host/port/credentials
- **Multi-Account Strategy**: Rotation and fallback across multiple email accounts per product
- **OTP Extraction**: Configurable regex patterns for OTP detection with fallback defaults
- **Email Filtering**: Sender-based filtering and custom search criteria
- **Connection Management**: Stateless IMAP connections with proper cleanup

## External Dependencies

### Core Infrastructure
- **Supabase**: Primary database, authentication, and real-time capabilities
- **Neon Database**: PostgreSQL hosting (via @neondatabase/serverless)

### Email Processing
- **imapflow**: Modern IMAP client for email retrieval
- **mailparser**: Email parsing and content extraction

### Frontend Dependencies
- **React Ecosystem**: React 18, Vite, TypeScript
- **UI Framework**: Radix UI primitives with shadcn/ui components
- **State Management**: TanStack Query for server state
- **Styling**: Tailwind CSS with PostCSS

### Backend Dependencies
- **Express.js**: Web framework with CORS support
- **Drizzle**: Type-safe ORM with schema validation
- **Crypto**: Node.js built-in crypto for AES-256-GCM encryption

### Development Tools
- **Build System**: Vite for frontend, esbuild for backend bundling
- **Type Checking**: TypeScript with strict mode enabled
- **Replit Integration**: Development banner and cartographer plugins