import React, { useState, useEffect, useCallback, useContext } from "react";
import { Button, Row, Col, Drawer, Typography } from "antd";
import { Link, useParams } from "react-router-dom";
import {
  AiOutlineLoading3Quarters,
  AiFillCloseCircle,
  AiOutlineCheck,
  AiTwotoneEnvironment,
  AiOutlineLogout,
} from "react-icons/ai";
import ReactLoading from "react-loading";
import QRCode from "qrcode.react";
import axios from "axios";
import { useTranslation } from "react-i18next";
import { PresaleContext } from "../providers/PresaleProvider";
import { WalletContext } from "../providers/WalletProvider";
import WalletNav from "../component/WalletNav";
import WalletPortfolio from "../views/WalletPortfolio";
import WalletSend from "../views/WalletSend";
import WalletActivity from "../views/WalletActivity";
import WalletManageKeys from "../views/WalletManageKeys";
import WalletProfile from "../views/WalletProfile";
import WalletBuy from "../views/Wallet/WalletBuy";
import setAuthToken from "../../utils/setAuthToken";
import WalletUtil from "../../utils/wallet";
import openNotification from "../helpers/notification";
import WalletLoadingModal from "../component/WalletComponents/WalletLoadingModal";
import { SERVER_URL, networks } from "../../constants/env";
import {
  getTokenBaseInfo,
  getTokenBalance,
  getTokenPriceInUsd,
} from "../../utils/tokenUtils";

const { Paragraph } = Typography;
const initTokenList = [{ name: "MGL", price: 0, balance: 0, address: "" }];
function Wallet() {
  const [t, i18n] = useTranslation();
  const [idx, setIdx] = useState(0);
  const [tokens, setTokens] = useState([]);
  const [network, setNetwork] = useState(networks[2]);
  const [tokensInfo, setTokensInfo] = useState([]);
  const [loading, setLoading] = useState(false);
  const [ethPrice, setEthPrice] = useState(0);
  const [totalPrice, setTotalPrice] = useState(0);
  const [connection, setConnection] = useState(true);
  const [publicKey, setPublicKey] = useState(localStorage.getItem("publicKey"));
  const [stopMode, setStopMode] = useState(true);
  const [visible, setVisible] = useState(false);
  const [transations, setTransactions] = useState([]);
  const { id, presaleToken, chainId } = useParams();
  const presaleData = useContext(PresaleContext);
  const walletData = useContext(WalletContext);
  const wallet = new WalletUtil();
  const serverUrl = SERVER_URL;
  let frequent;

  useEffect(() => {
    if (id) setIdx(parseInt(id));
    getAssets();
    getTransaction();
    getEthPrice();
    frequent = setInterval(getAssets, 1000 * 60);
    if (!publicKey)
      openNotification(
        "Wallet Access failed.",
        "You are not allowed!",
        false,
        () => (window.location.href = "/walletMain")
      );
    return () => {
      clearInterval(frequent);
    };
  }, []);
  useEffect(async () => {
    if (id && presaleToken && chainId) {
      let findNetwork = networks.filter((item) => item.chainId === chainId);
      let info = await getTokenBaseInfo(presaleToken, findNetwork[0].url);
      // let price = await getTokenPriceInUsd(findNetwork[0], presaleToken);
      let price = 0.018;
      presaleData.setPresaleData({
        ...info,
        id: id,
        toToken: presaleToken,
        network: findNetwork[0],
        price: price.toFixed(3),
      });
    }
  }, [id, presaleToken, chainId]);

  const getTokenInfo = async () => {
    setConnection(true);
    setLoading(true);

    try {
      const tokensInfoPromises = tokens.map(async (token) => {
        const { decimal, symbol } = await getTokenBaseInfo(token, network.url);

        const price =
          symbol.toLowerCase() === "mgl"
            ? 0.018
            : await getTokenPriceInUsd(network, token);

        const balance = await getTokenBalance(
          token,
          decimal,
          network.url,
          publicKey
        );

        return {
          name: symbol,
          price,
          balance,
          address: token,
        };
      });

      const tokensInfo = await Promise.all(tokensInfoPromises);

      //Filter tokens to not display empty / tokens not found
      const tokensAvailable = tokensInfo.filter((token) => token.name !== "");

      const totalPrice = tokensAvailable.reduce(
        (acc, { balance, price }) => acc + balance * price,
        0
      );

      setTokensInfo(tokensAvailable);
      setTotalPrice(totalPrice);
    } catch (error) {
      setConnection(false);
    } finally {
      setLoading(false);
    }
  };
  function findTokenName(tokenAddress) {
    return network.tokenList[tokenAddress].symbol;
  }

  const getAssets = async () => {
    walletData.getTokenList();
    setConnection(true);
    setLoading(true);
    setAuthToken(localStorage.jwtToken);
    axios
      .post(serverUrl + "wallets/getassets", {
        network: network.url,
        publicKey: publicKey,
      })
      .then((response) => {
        if (response.data.response) {
          setTokens(response.data.data);
        }
      })
      .catch((err) => {
        setConnection(false);
      });
  };

  const getEthPrice = async () => {
    try {
      const ethPriceResult = await axios.post(
        serverUrl + "wallets/getethprice",
        {
          publicKey: publicKey,
        }
      );

      if (ethPriceResult.status === 200) {
        const ethPrice = ethPriceResult.data.data;

        const formatValue = ethPrice.toFixed(3);

        setEthPrice(formatValue);
      }
    } catch (error) {
      console.log("error", error);
      setEthPrice(0);
    }
  };

  const getTransaction = async () => {
    walletData.getTransaction();

    setConnection(true);
    setAuthToken(localStorage.jwtToken);
    axios
      .post(serverUrl + "wallets/gettransaction", {
        network: network.url,
        publicKey: publicKey,
      })
      .then((response) => {
        if (response.data.response) {
          let oldtransaction = [];
          response.data.data.map((item) => oldtransaction.push(item.hash));
          setTransactions(oldtransaction);
        }
      })
      .catch((err) => {
        setConnection(false);
      });
  };
  const reload = () => {
    walletData.getTokenList();
    walletData.getTransaction();

    getAssets();
    getTransaction();
    getEthPrice();
  };
  const logout = () => {
    window.location.href = "/";
  };
  const changeNetwork = (chain) => {
    setNetwork(chain);
    walletData.setNetwork(chain);
    setVisible(false);
  };
  useEffect(() => {
    if (tokens.length > 0) getTokenInfo();
  }, [tokens]);
  useEffect(() => {
    if (network) getTransaction();
    if (tokens.length > 0) getAssets();
  }, [network]);

  useEffect(() => {
    if (tokensInfo.length > 0) setStopMode(false);
  }, [tokensInfo]);

  return (
    <>
      {publicKey ? (
        <Row className="bg-gray-200 h-screen">
          <Col span={4} className="text-gray-400 bg-white">
            <WalletNav setIdx={setIdx} idx={idx} />
          </Col>
          <Col span={20} className="">
            <Row className="h-full">
              <Col
                xs={{ span: 24 }}
                md={{ span: 18 }}
                className="flex flex-col"
              >
                <Row className="w-full">
                  <Col
                    xs={{ span: 24 }}
                    md={{ span: 10 }}
                    className="bg-white border-l-8 border-gray-200 p-4 flex justify-between items-center"
                  >
                    <div>
                      <div className="text-xl myColor1 p-0">
                        <a onClick={reload}>
                          {loading ? (
                            <ReactLoading
                              className="inline-block mr-2"
                              type="spinningBubbles"
                              color="#000"
                              height={20}
                              width={20}
                            />
                          ) : (
                            <AiOutlineCheck
                              className="inline-block mr-2"
                              size={20}
                            />
                          )}
                        </a>
                        {t("Balance")}
                      </div>
                      <p className="text-3xl font-bold myColor1 mt-2">
                        {t("Total Price")}
                      </p>
                      <p className="text-xl font-bold myColor1">
                        ${parseFloat(totalPrice).toFixed(3)} USD{" "}
                      </p>
                    </div>

                    <div>
                      <p className="text-3xl font-bold myColor1 mt-2">
                        {t("EthPrice")}
                      </p>
                      <p className="text-xl font-bold myColor1">
                        ${ethPrice} USD{" "}
                      </p>
                    </div>
                  </Col>

                  <Col
                    xs={{ span: 24 }}
                    md={{ span: 14 }}
                    className="bg-white border-l-8 border-gray-200 p-4 "
                  >
                    <Row className="text-xl myColor1 text-center">
                      <Col span={10}>{t("QR Code")}</Col>
                      <Col span={14}>{t("Wallet Address")}</Col>
                    </Row>
                    <Row className="mt-2  text-center">
                      <Col span={10} className="text-overflow">
                        <QRCode
                          size={100}
                          value={publicKey}
                          className="inline mr-2"
                        />
                      </Col>
                      <Col span={14}>
                        <Paragraph copyable className="myColor1 font-bold ">
                          {publicKey}
                        </Paragraph>
                      </Col>
                    </Row>
                  </Col>
                </Row>
                <Row className="bg-white border-l-8 border-gray-200 border-t-8 flex-grow ">
                  {idx === 0 ? (
                    <WalletPortfolio
                      tokensInfo={tokensInfo}
                      network={network.url}
                      getAssets={reload}
                    />
                  ) : idx === 1 ? (
                    <WalletSend
                      network={network}
                      tokensInfo={tokensInfo}
                      getAssets={reload}
                      transactions={transations}
                      setTransactions={setTransactions}
                      setIdx={setIdx}
                      setStopMode={setStopMode}
                    />
                  ) : idx === 2 ? (
                    <WalletBuy />
                  ) : idx === 3 ? (
                    <WalletActivity />
                  ) : idx === 4 ? (
                    <WalletManageKeys network={network} />
                  ) : idx === 5 ? (
                    <WalletProfile />
                  ) : null}
                </Row>
              </Col>
              <Col
                xs={{ span: 24 }}
                md={{ span: 6 }}
                className="bg-white border-l-8 border-gray-200 myColor1"
              >
                <Row className="border-b-8 border-gray-200 p-4 text-center">
                  <Col span={12} className="flex flex-col items-center">
                    {connection ? (
                      <AiTwotoneEnvironment
                        size={20}
                        className="text-green-500 inline mb-1 mr-1"
                      />
                    ) : (
                      <AiTwotoneEnvironment
                        size={20}
                        className="text-red-500 inline mb-1 mr-1"
                      />
                    )}
                    <div className=" text-overflow w-full">
                      <a onClick={() => setVisible(true)}>
                        {network.name.split(" ").map((item, idx) => (
                          <p key={idx} className="text-lg ">
                            {item}
                          </p>
                        ))}
                      </a>
                    </div>
                  </Col>
                  <Col span={12} className="flex flex-col items-center">
                    <AiOutlineLogout
                      size={20}
                      className="myColor1 inline mb-1 mr-1"
                    />
                    <div className=" text-overflow w-full">
                      <a onClick={logout}>
                        <p className="text-lg text-overflow">{t("Back")}</p>
                        <p className="text-lg text-overflow">
                          {t("to Exchange")}
                        </p>
                      </a>
                    </div>
                  </Col>
                </Row>
                <Row className="p-4 ">
                  <Col span={24} className="text-overflow">
                    <p className="text-2xl my-4">{t("Transactions")}</p>
                  </Col>
                  {transations.map((item, idx) => (
                    <Col span={24} className="text-overflow">
                      <a
                        target="_blank"
                        href={`${network.explorer}tx/${item}`}
                        className="my-2 myColor1"
                      >
                        {item}
                      </a>
                    </Col>
                  ))}
                </Row>
              </Col>
            </Row>
          </Col>
        </Row>
      ) : null}

      <WalletLoadingModal show={stopMode} />

      <Drawer
        className="myColor1 text-lg font-bold"
        headerStyle={{ color: "red" }}
        title="Change Network"
        placement="right"
        onClose={() => setVisible(false)}
        visible={visible}
        closeIcon={<AiFillCloseCircle size={20} />}
      >
        <a
          onClick={() => {
            changeNetwork(networks[0]);
          }}
        >
          <p className="mt-4 border-b-2 border-gray-200">Mainnet(Polygon)</p>
        </a>
        {/*<a onClick={()=>{changeNetwork(networks[1])}}><p className="mt-4 border-b-2 border-gray-200">Testnet(Polygon)</p></a>*/}
        {/*<p className="text-gray-400 mt-4 border-b-2 border-gray-200">Testnet(Polygon)</p>*/}
        <a
          onClick={() => {
            changeNetwork(networks[2]);
          }}
        >
          <p className="mt-4 border-b-2 border-gray-200">Mainnet(BSC)</p>
        </a>
        {/* <a onClick={()=>{changeNetwork(networks[3])}}><p className="mt-4 border-b-2 border-gray-200">Testnet(BSC)</p></a> */}
      </Drawer>
    </>
  );
}

export default Wallet;
