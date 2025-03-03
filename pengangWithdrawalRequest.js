require('dotenv').config();
const TonWeb = require('tonweb');
const BigNumber = require('bignumber.js');
BigNumber.config({ EXPONENTIAL_AT: 1e+9 });
const { mnemonicToKeyPair } = require('tonweb-mnemonic');

const XNODE_TON_ADMIN_ADDRESS = "PUBLIC KEY OF ADMIN ADDRESS"; //PUBLIC KEY OF ADMIN ADDRESS
const XNODE_MAINNET_SEED_PHRASE = "MNEMONIC OF PUBLIC ADDRESS";

TON_RPC = 'https://toncenter.com/api/v2/jsonRPC';
TON_API_KEY = '909104889c0b628c1fe5cba36a1f0298b02ac3d233f8f83e381205d1d8d2ee7b';
USDT_TON_CONTRACT = 'EQCxE6mUtQJKFnGfaROTKOt1lZbDiiX1kCixRv7Nw2Id_sDs'; //USDT CONTRACT ADDRESS

const tonweb = new TonWeb(new TonWeb.HttpProvider(TON_RPC,{apiKey: TON_API_KEY}));

const getTonAdminWallet = async () => {
    const keyPair = await mnemonicToKeyPair(XNODE_MAINNET_SEED_PHRASE.split(' '));
    console.log(keyPair);

    const WalletClass = tonweb.wallet.all.v4R2; // Use the correct wallet class

    const wallet = new WalletClass(tonweb.provider, {
        publicKey: keyPair.publicKey,
        wc: 0,
    });

    return { keyPair, wallet };
};

const transferOnTONChainInternal = async (toAddress, amount, depositId) => {
    try {
        const { keyPair, wallet } = await getTonAdminWallet();
        // Get current seqno

        const seqno = await wallet.methods.seqno().call();
        const jettonMinter = new TonWeb.token.jetton.JettonMinter(tonweb.provider, { address: USDT_TON_CONTRACT });
        const jettonWalletAddress = await jettonMinter.getJettonWalletAddress(new TonWeb.utils.Address(XNODE_TON_ADMIN_ADDRESS));
        const jettonWallet = new TonWeb.token.jetton.JettonWallet(tonweb.provider, {
            address: jettonWalletAddress
        });

        const comment = new Uint8Array([...new Uint8Array(4), ...new TextEncoder().encode(`Pengang Withdrawl Transfer`)]);

        const data = await jettonWallet.getData();
        console.log('Jetton balance:', data.balance.toString());
        // return false;

        const jettonAmount = TonWeb.utils.toNano(amount.toString());

        console.log("jettonAmount", jettonAmount);
        // return false;

        // Execute the transfer
        let TxHash = await wallet.methods.transfer({
            secretKey: keyPair.secretKey,
            toAddress: jettonWalletAddress,
            amount: TonWeb.utils.toNano('0.01'), // TONs for transfer
            seqno: (seqno == null)? 0 : seqno,
            payload: await jettonWallet.createTransferBody({
                jettonAmount: jettonAmount,
                toAddress: new TonWeb.utils.Address(toAddress),
                forwardAmount: TonWeb.utils.toNano('0'),
                forwardPayload: comment,
                responseAddress: new TonWeb.utils.Address(XNODE_TON_ADMIN_ADDRESS)
            }),
            sendMode: 3, //
        }).send();

        console.log(`[SUCCESS] Sent ${amount} to ${toAddress} with deposit id: ${depositId}`, TxHash);
        return true;
    } catch (error) {
        console.log(`[ERROR] Couldn't send ${amount} to ${toAddress} with deposit id: ${depositId}\n`, error);
        throw error;
    }
};

transferOnTONChainInternal(USER WITHDRAWL ADDRESS, 0.384, ""); //amount/1000
