const Web3 = require("web3");

const minABI = require("./erc20_abi.json");
const ROUTER_ABI = require("./router_abi.json");

export function getTokenType(networkUrl) {
  if (networkUrl === "polygon-mainnet" || networkUrl === "polygon-testnet")
    return "ERC-20";
  if (networkUrl === "bsc-mainnet" || networkUrl === "bsc-testnet")
    return "BEP-20";
  return "UNKNOWN";
}
export async function getTokenBaseInfo(address, networkUrl) {
  let rpcUrl = getRpcUrl(networkUrl);
  if (!rpcUrl) return { name: "", symbol: "", decimal: 0 };
  let web3 = new Web3(rpcUrl);

  try {
    if (
      address === "0x0000000000000000000000000000000000001010" &&
      networkUrl === "bsc-mainnet"
    ) {
      return {
        name: "BNB",
        symbol: "BNB",
        decimal: 18,
      };
    } else {
      const contract = new web3.eth.Contract(minABI, address);

      const [tokenName, tokenSymbol, tokenDecimal] = await Promise.all([
        contract.methods.name().call(),
        contract.methods.symbol().call(),
        contract.methods.decimals().call(),
      ]);

      return {
        name: tokenName,
        symbol: tokenSymbol,
        decimal: tokenDecimal,
      };
    }
  } catch (error) {
    return {
      name: "",
      symbol: "",
      decimal: 0,
    };
  }
}
export async function getTokenBalance(
  tokenAddress,
  decimal,
  networkUrl,
  publicKey
) {
  try {
    let rpcUrl = getRpcUrl(networkUrl);
    if (!rpcUrl) return;

    let web3 = new Web3(rpcUrl);

    if (
      tokenAddress === "0x0000000000000000000000000000000000001010" &&
      networkUrl === "bsc-mainnet"
    ) {
      let balance = await web3.eth.getBalance(publicKey);
      return Number(balance) / Math.pow(10, 18);
    } else {
      let contract = new web3.eth.Contract(minABI, tokenAddress);
      let balance = await contract.methods.balanceOf(publicKey).call();
      //console.log(tokenAddress, decimal)
      return Number(balance) / Math.pow(10, decimal);
    }
  } catch (error) {
    return 0;
  }
}
export async function getTokenPriceInUsd(network, tokenAddr) {
  try {
    let web3 = new Web3(getRpcUrl(network.url));
    const routerContract = new web3.eth.Contract(
      ROUTER_ABI,
      network.routerAddr
    );

    let res = await routerContract.methods
      .getAmountsOut("1000000000000000000", [
        network.baseTokenAddr,
        network.usdAddr,
      ])
      .call();

    const basePrice = Number(res[1]) / Math.pow(10, network.usdDecimal);

    if (tokenAddr === "0x0000000000000000000000000000000000001010") {
      return basePrice;
    }

    //console.log('base price', basePrice, tokenAddr, network.baseTokenAddr)
    let { decimal } = await getTokenBaseInfo(tokenAddr, network.url);

    let amount = await routerContract.methods
      .getAmountsOut(Math.pow(10, decimal) + "", [
        tokenAddr,
        network.baseTokenAddr,
      ])
      .call();
    //console.log('what is s', amount)
    return (amount[1] / Math.pow(10, 18)) * basePrice;
  } catch (error) {
    return 0;
  }
}
export async function getEstimatedGasLimit(
  tokenAddress,
  networkUrl,
  to,
  from,
  amount
) {
  let rpcUrl = getRpcUrl(networkUrl);

  if (!rpcUrl) return;
  const web3 = new Web3(rpcUrl);

  const contract = new web3.eth.Contract(minABI, tokenAddress);
  const gasLimit = await contract.methods
    .transfer(to, parseInt(amount))
    .estimateGas({ from: from });
  return gasLimit * 1.5;
}
function getRpcUrl(network) {
  if (network === "polygon-mainnet") {
    return "https://polygon-rpc.com:443";
  } else if (network === "polygon-testnet") {
    return "https://rpc-mumbai.maticvigil.com:443";
  } else if (network === "bsc-mainnet") {
    return "https://bsc-dataseed1.binance.org";
  } else if (network === "bsc-testnet") {
    return "https://data-seed-prebsc-1-s1.binance.org:8545";
  } else return false;
}
