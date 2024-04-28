I've decided to open source the most minimalistic approach to sniping Raydium pools that is currently possible.  

FIXED:  
clone -> npm install  
replace keypair and rpc url  

and it will start swapping into every new pool that opens for 0.001 sol. adjust the amount in the first arg of the swap call (await swap(keys, LAMPORTS, 0))  

Disclaimer: This is not the the ideal sniper as it still uses RPC calls, but this is as lightweight and simple as it gets at about 20mb of data to run 24/7 as opposed to 50-100gb.  

If you're interested in sniping pools with 0 RPC calls and land txs in the block after pool creation (or volume bots, or token filters, or init + swap w/ jito, etc etc) feel free to add me  

Discord: shadowystupidcoder
