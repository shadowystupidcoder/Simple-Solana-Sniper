/*shadowystupidcoders dumb 140 line demo sniper */
import { PublicKey, Keypair, Connection, ComputeBudgetProgram, SystemProgram, Transaction, TransactionInstruction } from '@solana/web3.js';
import { u8, struct, NearUInt64 } from "@solana/buffer-layout"
import { u64, publicKey } from "@solana/buffer-layout-utils"
import * as spl from "@solana/spl-token"
import BN from 'bn.js'
const connection = new Connection("https://convincing-crimson-mountain.solana-mainnet.quiknode.pro/6192ef92b88a7967fe5e4dc/")
const ray = new PublicKey('675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8')
const wallet = Keypair.fromSecretKey(Uint8Array.from([84,152,1,181,19,93,227,6,144,192,159,16,77,26,147,73,131,228,153,61,41,86,75,247,46,116,132,161,147]))
const raydiumFees = new PublicKey("7YttLkHDoNj9wyDur5pM1ejNaAvT9X4eqaYcHQqtj2G5");
const initLog = struct([u8('logType'), u64('openTime'), u8('quoteDecimals'), u8('baseDecimals'), u64('quoteLotSize'), u64('baseLotSize'), u64('quoteAmount'), u64('baseAmount'), publicKey('market') ]);

// 1. listening to the logs from the raydium fee address
async function snipe() {
console.log("listening for new raydium pools...")
connection.onLogs(raydiumFees, async (logs) => {
console.log(logs.logs)
for (const log of logs.logs) {
if (log.includes("ray_log")) {
const rayLog = log.split(" ").pop().replace("'", "");
console.log(Buffer.from(rayLog, "base64").length)
const { market, baseDecimals, quoteDecimals, openTime } = initLog.decode(Buffer.from(rayLog, "base64"));
console.log(market)
const keys = await getKeys(market, baseDecimals, quoteDecimals);
console.log(keys)
try {
const tx = await swap(keys, 100000, 0);
console.log(tx)
const sent = await connection.sendTransaction(tx, [wallet])
console.log("swapped in tx id:", sent)
} catch(E) { "pool probably wasn't open yet:", openTime, Date.now() }
}
}
})}




snipe()

// 2. getting all the pool keys
async function getKeys(marketId, baseDecimals, quoteDecimals) {
const getAta = async (mint, publicKey) => PublicKey.findProgramAddressSync([publicKey.toBuffer(), spl.TOKEN_PROGRAM_ID.toBuffer(), mint.toBuffer()], spl.ASSOCIATED_TOKEN_PROGRAM_ID)[0];
async function getMarketInfo(marketId) {
const info = await connection.getAccountInfo(marketId)
const ownAddress = new PublicKey(info.data.slice(13, 45))
const vaultSignerNonce = new NearUInt64().decode(new Uint8Array((info).data.subarray(45, 53)))
const baseMint = new PublicKey(info.data.slice(53, 85))
const quoteMint = new PublicKey(info.data.slice(85, 117))
const bids = new PublicKey(info.data.slice(285, 317))
const asks = new PublicKey(info.data.slice(317, 349))
const event = new PublicKey(info.data.slice(253, 285))
const baseVault = new PublicKey(info.data.slice(117, 149))
const quoteVault = new PublicKey(info.data.slice(165, 197))
const marketInfo = {
ownAddress,
vaultSignerNonce,
baseMint,
quoteMint,
bids,
asks,
event,
baseVault,
quoteVault}
return(marketInfo)
}
const marketInfo = await getMarketInfo(marketId)
const [baseMint, quoteMint] = [marketInfo.baseMint, marketInfo.quoteMint];
const [ownerBaseAta, ownerQuoteAta] = await Promise.all([getAta(baseMint, wallet.publicKey), getAta(quoteMint, wallet.publicKey)]);
const authority = PublicKey.findProgramAddressSync([Buffer.from([97, 109, 109, 32, 97, 117, 116, 104, 111, 114, 105, 116, 121])], ray)[0];
const marketAuthority = PublicKey.createProgramAddressSync([marketId.toBuffer(), Buffer.from([Number(marketInfo.vaultSignerNonce.toString())]), Buffer.alloc(7)], new PublicKey('srmqPvymJeFKQ4zGQed1GFppgkRHL9kaELCbyksJtPX'));
const seeds = ['amm_associated_seed', 'coin_vault_associated_seed', 'pc_vault_associated_seed', 'lp_mint_associated_seed', 'temp_lp_token_associated_seed', 'target_associated_seed', 'withdraw_associated_seed', 'open_order_associated_seed', 'pc_vault_associated_seed'].map(seed => Buffer.from(seed, 'utf-8'));
const [id, baseVault, coinVault, lpMint, lpVault, targetOrders, withdrawQueue, openOrders, quoteVault] = await Promise.all(seeds.map(seed => PublicKey.findProgramAddress([ray.toBuffer(), marketId.toBuffer(), seed], ray)));
return({
    programId: ray,
    baseMint,
    quoteMint,
    ownerBaseAta,
    ownerQuoteAta,
    baseDecimals,
    quoteDecimals,
    tokenProgram: new PublicKey("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"),
    lpDecimals: baseDecimals,
    authority,
    marketAuthority,
    marketProgramId: new PublicKey('srmqPvymJeFKQ4zGQed1GFppgkRHL9kaELCbyksJtPX'),
    marketId,
    marketBids: marketInfo.bids,
    marketAsks: marketInfo.asks,
    marketQuoteVault: marketInfo.quoteVault,
    marketBaseVault: marketInfo.baseVault,
    marketEventQueue: marketInfo.event,
    id: id[0],
    baseVault: baseVault[0],
    coinVault: coinVault[0],
    lpMint: lpMint[0],
    lpVault: lpVault[0],
    targetOrders: targetOrders[0],
    withdrawQueue: withdrawQueue[0],
    openOrders: openOrders[0],
    quoteVault: quoteVault[0],
    lookupTableAccount: PublicKey.default,
    wallet: wallet.publicKey})}
// 3. build and send the swap transaction
async function swap(keys, amountIn, minAmountOut) {
    const accountMetas = [
	{pubkey: keys.tokenProgram,     isSigner: false, isWritable: false},    // token program
	{pubkey: keys.id,               isSigner: false, isWritable: true},     // amm/pool id
	{pubkey: keys.authority,        isSigner: false, isWritable: false},    // amm/pool authority
	{pubkey: keys.openOrders,       isSigner: false, isWritable: true},     // amm/pool open orders
	{pubkey: keys.targetOrders,     isSigner: false, isWritable: true},     // amm/pool target orders
	{pubkey: keys.baseVault,        isSigner: false, isWritable: true},     // amm/pool baseVault/pool coin token account
	{pubkey: keys.quoteVault,       isSigner: false, isWritable: true},     // amm/pool quoteVault/pool pc token account
	{pubkey: keys.marketProgramId,  isSigner: false, isWritable: false},    // openbook program id
	{pubkey: keys.marketId,         isSigner: false, isWritable: true},     // openbook market
	{pubkey: keys.marketBids,       isSigner: false, isWritable: true},     // openbook bids
	{pubkey: keys.marketAsks,       isSigner: false, isWritable: true},     // openbook asks
	{pubkey: keys.marketEventQueue, isSigner: false, isWritable: true},     // openbook event queue
	{pubkey: keys.marketBaseVault,  isSigner: false, isWritable: true},     // marketBaseVault/openbook coin vault
	{pubkey: keys.marketQuoteVault, isSigner: false, isWritable: true},     // marketQuoteVault/openbook pc vault
	{pubkey: keys.marketAuthority,  isSigner: false, isWritable: false},    // marketAuthority/openbook vault signer
	{pubkey: keys.ownerQuoteAta,    isSigner: false, isWritable: true},     // wallet wsol account
	{pubkey: keys.ownerBaseAta,     isSigner: false, isWritable: true},     // wallet token account
	{pubkey: wallet.publicKey,      isSigner: true,  isWritable: true}]     // wallet pubkey
	const buffer = Buffer.alloc(16);
	new BN(amountIn).toArrayLike(Buffer, 'le', 8).copy(buffer, 0);
	new BN(minAmountOut).toArrayLike(Buffer, 'le', 8).copy(buffer, 8);
	const swap = new TransactionInstruction({ keys: accountMetas, programId: ray, data: Buffer.concat([Buffer.from([0x09]), buffer]) })
	const uPrice = ComputeBudgetProgram.setComputeUnitPrice({microLamports: 200000})
	const quoteAta = spl.createAssociatedTokenAccountIdempotentInstruction(wallet.publicKey, keys.ownerQuoteAta, wallet.publicKey, keys.quoteMint)
	const tokenAta = spl.createAssociatedTokenAccountIdempotentInstruction(wallet.publicKey, keys.ownerBaseAta, wallet.publicKey, keys.baseMint)
	const closeSol = spl.createCloseAccountInstruction(keys.ownerQuoteAta, wallet.publicKey, wallet.publicKey)
	const transaction = new Transaction()
	transaction.add(uPrice)
	transaction.add(quoteAta)
	transaction.add(SystemProgram.transfer({fromPubkey: wallet.publicKey, toPubkey: keys.ownerQuoteAta, lamports: amountIn }), spl.createSyncNativeInstruction(keys.ownerQuoteAta))
	transaction.add(tokenAta)
	transaction.add(swap)
	transaction.add(closeSol)
return(transaction) }
