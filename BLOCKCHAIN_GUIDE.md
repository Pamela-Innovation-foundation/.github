# Blockchain & Ethereum Guide

## What is "Open ETH"?

"Open ETH" can refer to several different concepts depending on the context:

### 1. **OpenZeppelin Ethereum Contracts**

[OpenZeppelin](https://www.openzeppelin.com/) is a popular open-source library for secure smart contract development on Ethereum. When someone mentions "Open ETH," they might be referring to:

- OpenZeppelin's Ethereum contract libraries
- Open-source Ethereum development tools
- Community-driven Ethereum projects

### 2. **Ethereum (ETH) - Open Blockchain**

Ethereum is an open, public blockchain platform that allows developers to:

- Build decentralized applications (dApps)
- Create and deploy smart contracts
- Handle cryptocurrency transactions (ETH)
- Interact with the Ethereum network through various APIs

### 3. **Open Ethereum Projects**

This could refer to:

- Open-source Ethereum clients (like Geth, Nethermind, or Besu)
- Public Ethereum testnets (Sepolia, Goerli, etc.)
- Community-maintained Ethereum tools and libraries

## This Project's Blockchain Integration

This Cloudflare Workers project (`pamela`) includes blockchain webhook handling capabilities:

### Blockchain Webhook Handler

- **File**: `src/index.ts` (unified worker with blockchain webhook support)
- **Purpose**: Receives and stores blockchain webhook data in a D1 database
- **Endpoint**: POST `/webhook`
- **Database**: Stores webhook data in `BlockchainWebhooks` table

### Use Cases

This webhook handler can be used to:

1. **Monitor Ethereum transactions** - Receive notifications when specific ETH transactions occur
2. **Track smart contract events** - Listen for events emitted by smart contracts
3. **Process blockchain data** - Store and analyze blockchain activity
4. **Build blockchain-aware applications** - React to on-chain events in your application

## Getting Started with Blockchain Webhooks

### Setting Up a Webhook Provider

Common blockchain webhook services include:

- **Alchemy**: Provides Ethereum and other blockchain webhooks
- **Infura**: Ethereum infrastructure and webhook notifications
- **Moralis**: Web3 development platform with webhook support
- **QuickNode**: Blockchain node provider with event notifications

### Example Webhook Payload

When a blockchain event occurs, your webhook endpoint receives data like:

```json
{
  "network": "ethereum",
  "event": "transaction",
  "txHash": "0x1234...",
  "from": "0xabcd...",
  "to": "0xefgh...",
  "value": "1000000000000000000",
  "blockNumber": 12345678,
  "timestamp": "2026-02-05T14:25:18.169Z"
}
```

### Testing Your Webhook

You can test the webhook endpoint locally:

```bash
# Start the local development server
npm run dev

# In another terminal, send a test webhook
curl -X POST http://localhost:8787/webhook \
  -H "Content-Type: application/json" \
  -d '{
    "network": "ethereum",
    "event": "test",
    "data": "sample blockchain data"
  }'
```

## Resources

### Ethereum Development

- [Ethereum Official Website](https://ethereum.org/)
- [Ethereum Developer Documentation](https://ethereum.org/developers)
- [Web3.js Library](https://web3js.readthedocs.io/)
- [Ethers.js Library](https://docs.ethers.org/)

### OpenZeppelin

- [OpenZeppelin Contracts](https://docs.openzeppelin.com/contracts/)
- [OpenZeppelin GitHub](https://github.com/OpenZeppelin/openzeppelin-contracts)

### Cloudflare Workers & Blockchain

- [Cloudflare Workers Documentation](https://developers.cloudflare.com/workers/)
- [Cloudflare D1 Database](https://developers.cloudflare.com/d1/)
- [Cloudflare Workers with Web3](https://developers.cloudflare.com/workers/examples/)

## Need Help?

If you have questions about:

- **Ethereum integration** - Check the Ethereum documentation or community forums
- **OpenZeppelin contracts** - Visit the OpenZeppelin documentation
- **This project's webhook handler** - See `src/index.ts` for implementation details (unified worker)
- **Cloudflare Workers** - Refer to the Cloudflare Workers documentation

For project-specific questions, please open an issue in the GitHub repository.
