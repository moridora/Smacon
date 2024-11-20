"use strict";

//画面の切り替え
const g_elementDivSyncScreen = document.getElementById("div_sync_screen");
const g_elementDivTopScreen = document.getElementById("div_top_screen");

let g_mapRtcPeerConnection = new Map();

// クライアントからサーバーへの接続要求
const g_socket = io.connect();

// スマホとPCの切り替え
const smartphoneScreen = document.getElementById("smartphone");
const desktopScreen = document.getElementById("desktop");
const syncScreen = document.getElementById("div_sync_screen");

// センサ値
let deviceMotionData = { x: 0, y: 0, z: 0 };
let deviceOrientationData = { gamma: null, beta: null, alpha: null };
let devicebeta = 0;

// UIから呼ばれる関数

// ページがunloadされる（閉じる、再読み込み、別ページへ移動）直前に呼ばれる関数
window.addEventListener("beforeunload", (event) => {
  event.preventDefault(); // 既定の動作のキャンセル

  onclickButton_LeaveChat(); // チャットからの離脱
  g_socket.disconnect(); // Socket.ioによるサーバーとの接続の切断

  e.returnValue = ""; // Chrome では returnValue を設定する必要がある
  return ""; // Chrome 以外では、return を設定する必要がある
});

// 同期ボタンを押すと呼ばれる関数
function onsubmitButton_Join() {
  console.log("UI Event : 'Join' button clicked.");

  // サーバーに"join"を送信
  console.log("- Send 'Join' to server");
  g_socket.emit("join", {});

  // 画面の切り替え
  g_elementDivSyncScreen.style.display = "none"; // 同期画面の非表示
  g_elementDivTopScreen.style.display = "block"; // Top画面の表示
}

// ページから離れるときに呼ばれる関数
function onclickButton_LeaveChat() {
  console.log("UI Event : 'Leave Chat.' button clicked.");

  g_mapRtcPeerConnection.forEach((rtcPeerConnection) => {
    if (isDataChannelOpen(rtcPeerConnection)) {
      console.log("- Send 'leave' through DataChannel");
      rtcPeerConnection.datachannel.send(
        JSON.stringify({ type: "leave", data: "" })
      );
    }

    console.log("Call : endPeerConnection()");
    endPeerConnection(rtcPeerConnection);
  });

  // 画面の切り替え
  g_elementDivTopScreen.style.display = "none"; // 動機画面の非表示
  g_elementDivSyncScreen.style.display = "flex"; // Top画面の表示
}

// Socket.IO関連の関数

// 接続時の処理
// ・サーバーとクライアントの接続が確立すると、
// 　サーバー側で、"connection"イベント
// 　クライアント側で、"connect"イベントが発生する
g_socket.on("connect", () => {
  console.log("Socket Event : connect");
});

// サーバーからのメッセージ受信に対する処理
// ・サーバー側のメッセージ拡散時の「io.broadcast.emit( "signaling", objData );」に対する処理
g_socket.on("signaling", (objData) => {
  console.log("Socket Event : signaling");
  console.log("- type : ", objData.type);
  console.log("- data : ", objData.data);

  // 送信元のSocketID
  let strRemoteSocketID = objData.from;
  console.log("- from : ", objData.from);

  if ("join" === objData.type) {
    if (g_mapRtcPeerConnection.get(strRemoteSocketID)) {
      // 既にコネクションオブジェクトあり
      alert("Connection object already exists.");
      return;
    }
    alert("Connection!!");

    // RTCPeerConnectionオブジェクトの作成
    console.log("Call : createPeerConnection()");
    let rtcPeerConnection = createPeerConnection(strRemoteSocketID);
    g_mapRtcPeerConnection.set(strRemoteSocketID, rtcPeerConnection); // グローバル変数に設定

    // DataChannelの作成
    let datachannel = rtcPeerConnection.createDataChannel("datachannel");
    // DataChannelオブジェクトをRTCPeerConnectionオブジェクトのメンバーに追加。
    rtcPeerConnection.datachannel = datachannel;
    // DataChannelオブジェクトのイベントハンドラの構築
    console.log("Call : setupDataChannelEventHandler()");
    setupDataChannelEventHandler(rtcPeerConnection);

    // OfferSDPの作成
    console.log("Call : createOfferSDP()");
    createOfferSDP(rtcPeerConnection);
  } else if ("offer" === objData.type) {
    // onclickButton_SetOfferSDPandCreateAnswerSDP()と同様の処理
    // 設定するOffserSDPとして、テキストエリアのデータではなく、受信したデータを使用する。

    if (g_mapRtcPeerConnection.get(strRemoteSocketID)) {
      // 既にコネクションオブジェクトあり
      alert("Connection object already exists.");
      return;
    }

    // RTCPeerConnectionオブジェクトの作成
    console.log("Call : createPeerConnection()");
    let rtcPeerConnection = createPeerConnection(strRemoteSocketID);
    g_mapRtcPeerConnection.set(strRemoteSocketID, rtcPeerConnection); // グローバル変数に設定

    // OfferSDPの設定とAnswerSDPの作成
    console.log("Call : setOfferSDP_and_createAnswerSDP()");
    setOfferSDP_and_createAnswerSDP(rtcPeerConnection, objData.data); // 受信したSDPオブジェクトを渡す。
  } else if ("answer" === objData.type) {
    // onclickButton_SetAnswerSDPthenChatStarts()と同様の処理
    // 設定するAnswerSDPとして、テキストエリアのデータではなく、受信したデータを使用する。

    let rtcPeerConnection = g_mapRtcPeerConnection.get(strRemoteSocketID);

    if (!rtcPeerConnection) {
      // コネクションオブジェクトがない
      alert("Connection object does not exist.");
      return;
    }

    // AnswerSDPの設定
    console.log("Call : setAnswerSDP()");
    setAnswerSDP(rtcPeerConnection, objData.data); // 受信したSDPオブジェクトを渡す。
  } else if ("candidate" === objData.type) {
    let rtcPeerConnection = g_mapRtcPeerConnection.get(strRemoteSocketID);

    if (!rtcPeerConnection) {
      // コネクションオブジェクトがない
      alert("Connection object does not exist.");
      return;
    }

    // Vanilla ICEの場合は、ここには来ない。
    // Trickle ICEの場合は、相手側のICE candidateイベントで送信されたICE candidateを、コネクションに追加する。

    // ICE candidateの追加
    console.log("Call : addCandidate()");
    addCandidate(rtcPeerConnection, objData.data); // 受信したICE candidateの追加
  } else {
    console.error("Unexpected : Socket Event : signaling");
  }
});

// DataChannel関連の関数

// DataChannelオブジェクトのイベントハンドラの構築
function setupDataChannelEventHandler(rtcPeerConnection) {
  if (!("datachannel" in rtcPeerConnection)) {
    console.error("Unexpected : DataChannel does not exist.");
    return;
  }

  // message イベントが発生したときのイベントハンドラ
  rtcPeerConnection.datachannel.onmessage = (event) => {
    console.log("DataChannel Event : message");
    let objData = JSON.parse(event.data);
    console.log("- type : ", objData.type);

    console.log("- data : ", objData.data);

    if ("message" === objData.type) {
      if (objData.data.deviceOrientationData.gamma > 0)
        devicebeta = objData.data.deviceOrientationData.beta;
      else devicebeta = -Number(objData.data.deviceOrientationData.beta);
    } else if ("offer" === objData.type) {
      // 受信したOfferSDPの設定とAnswerSDPの作成
      console.log("Call : setOfferSDP_and_createAnswerSDP()");
      setOfferSDP_and_createAnswerSDP(rtcPeerConnection, objData.data);
    } else if ("answer" === objData.type) {
      // 受信したAnswerSDPの設定
      console.log("Call : setAnswerSDP()");
      setAnswerSDP(rtcPeerConnection, objData.data);
    } else if ("candidate" === objData.type) {
      // 受信したICE candidateの追加
      console.log("Call : addCandidate()");
      addCandidate(rtcPeerConnection, objData.data);
    } else if ("leave" === objData.type) {
      console.log("Call : endPeerConnection()");
      endPeerConnection(rtcPeerConnection);
    }
  };
}

// DataChannelが開いているか
function isDataChannelOpen(rtcPeerConnection) {
  if (!("datachannel" in rtcPeerConnection)) {
    // datachannelメンバーが存在しない
    return false;
  }
  if (!rtcPeerConnection.datachannel) {
    // datachannelメンバーがnull
    return false;
  }
  if ("open" !== rtcPeerConnection.datachannel.readyState) {
    // datachannelメンバーはあるが、"open"でない。
    return false;
  }
  // DataCchannelが開いている
  return true;
}

// RTCPeerConnection関連の関数

// RTCPeerConnectionオブジェクトの作成
function createPeerConnection(strRemoteSocketID) {
  // RTCPeerConnectionオブジェクトの生成
  let config = {
    iceServers: [
      { urls: "stun:stun.l.google.com:19302" },
      { urls: "stun:stun1.l.google.com:19302" },
      { urls: "stun:stun2.l.google.com:19302" },
    ],
  };
  let rtcPeerConnection = new RTCPeerConnection(config);

  // チャット相手のSocketIDをRTCPeerConnectionオブジェクトのメンバーに追加。
  rtcPeerConnection.strRemoteSocketID = strRemoteSocketID;

  // RTCPeerConnectionオブジェクトのイベントハンドラの構築
  setupRTCPeerConnectionEventHandler(rtcPeerConnection);
  return rtcPeerConnection;
}

// コネクションの終了処理
function endPeerConnection(rtcPeerConnection) {
  // DataChannelの終了
  if ("datachannel" in rtcPeerConnection) {
    rtcPeerConnection.datachannel.close();
    rtcPeerConnection.datachannel = null;
  }

  // グローバル変数Mapから削除
  g_mapRtcPeerConnection.delete(rtcPeerConnection.strRemoteSocketID);

  // ピアコネクションの終了
  rtcPeerConnection.close();
}

// RTCPeerConnectionオブジェクトのイベントハンドラの構築
function setupRTCPeerConnectionEventHandler(rtcPeerConnection) {
  // Negotiation needed イベントが発生したときのイベントハンドラ
  rtcPeerConnection.onnegotiationneeded = () => {
    console.log("Event : Negotiation needed");

    if (!isDataChannelOpen(rtcPeerConnection)) {
    } else {
      // OfferSDPを作成し、DataChannelを通して相手に直接送信
      console.log("Call : createOfferSDP()");
      createOfferSDP(rtcPeerConnection);
    }
  };

  // ICE candidate イベントが発生したときのイベントハンドラ
  rtcPeerConnection.onicecandidate = (event) => {
    console.log("Event : ICE candidate");
    if (event.candidate) {
      // ICE candidateがある
      console.log("- ICE candidate : ", event.candidate);

      // Vanilla ICEの場合は、何もしない
      // Trickle ICEの場合は、ICE candidateを相手に送る

      if (!isDataChannelOpen(rtcPeerConnection)) {
        // ICE candidateをサーバーを経由して相手に送信
        console.log("- Send ICE candidate to server");
        g_socket.emit("signaling", {
          to: rtcPeerConnection.strRemoteSocketID,
          type: "candidate",
          data: event.candidate,
        });
      } else {
        // ICE candidateをDataChannelを通して相手に直接送信
        console.log("- Send ICE candidate through DataChannel");
        rtcPeerConnection.datachannel.send(
          JSON.stringify({ type: "candidate", data: event.candidate })
        );
      }
    } else {
      // ICE candiateがない = ICE candidate の収集終了。
      console.log("- ICE candidate : empty");
    }
  };

  // ICE candidate error イベントが発生したときのイベントハンドラ
  // - このイベントは、ICE候補の収集処理中にエラーが発生した場合に発生する。
  //   see : https://developer.mozilla.org/en-US/docs/Web/API/RTCPeerConnection/onicecandidateerror
  rtcPeerConnection.onicecandidateerror = (event) => {
    console.error(
      "Event : ICE candidate error. error code : ",
      event.errorCode
    );
  };

  // ICE gathering state change イベントが発生したときのイベントハンドラ
  // - このイベントは、ICE gathering stateが変化したときに発生する。
  //   言い換えれば、ICEエージェントがアクティブに候補者を収集しているかどうかが変化したときに発生する。
  //   see : https://developer.mozilla.org/en-US/docs/Web/API/RTCPeerConnection/onicegatheringstatechange
  rtcPeerConnection.onicegatheringstatechange = () => {
    console.log("Event : ICE gathering state change");
    console.log(
      "- ICE gathering state : ",
      rtcPeerConnection.iceGatheringState
    );

    if ("complete" === rtcPeerConnection.iceGatheringState) {
      // Vanilla ICEの場合は、ICE candidateを含んだOfferSDP/AnswerSDPを相手に送る
      // Trickle ICEの場合は、何もしない

      if ("offer" === rtcPeerConnection.localDescription.type) {
        // OfferSDPをサーバーに送信
      } else if ("answer" === rtcPeerConnection.localDescription.type) {
        // AnswerSDPをサーバーに送信
      } else {
        console.error(
          "Unexpected : Unknown localDescription.type. type = ",
          rtcPeerConnection.localDescription.type
        );
      }
    }
  };

  // ICE connection state change イベントが発生したときのイベントハンドラ
  rtcPeerConnection.oniceconnectionstatechange = () => {
    console.log("Event : ICE connection state change");
    console.log(
      "- ICE connection state : ",
      rtcPeerConnection.iceConnectionState
    );
  };

  // Signaling state change イベントが発生したときのイベントハンドラ
  rtcPeerConnection.onsignalingstatechange = () => {
    console.log("Event : Signaling state change");
    console.log("- Signaling state : ", rtcPeerConnection.signalingState);
  };

  // Connection state change イベントが発生したときのイベントハンドラ
  rtcPeerConnection.onconnectionstatechange = () => {
    console.log("Event : Connection state change");
    console.log("- Connection state : ", rtcPeerConnection.connectionState);

    if ("failed" === rtcPeerConnection.connectionState) {
      console.log("Call : endPeerConnection()");
      endPeerConnection(rtcPeerConnection);
    }
  };

  // Data channel イベントが発生したときのイベントハンドラ
  rtcPeerConnection.ondatachannel = (event) => {
    console.log("Event : Data channel");

    // DataChannelオブジェクトをRTCPeerConnectionオブジェクトのメンバーに追加。
    rtcPeerConnection.datachannel = event.channel;
    // DataChannelオブジェクトのイベントハンドラの構築
    console.log("Call : setupDataChannelEventHandler()");
    setupDataChannelEventHandler(rtcPeerConnection);

    // オファーをされた側として、OfferSDPを作成し、DataChannelを通して相手に直接送信
    //   オファーされた側として、OfferSDPを作成、送信することで、
    //   オファーした側、オファーされた側、双方で必要な通信ストリームが整う。）
    console.log("Call : createOfferSDP()");
    createOfferSDP(rtcPeerConnection);
  };
}

// OfferSDPの作成
function createOfferSDP(rtcPeerConnection) {
  // OfferSDPの作成
  console.log("Call : rtcPeerConnection.createOffer()");
  rtcPeerConnection
    .createOffer()
    .then((sessionDescription) => {
      // 作成されたOfferSDPををLocalDescriptionに設定
      console.log("Call : rtcPeerConnection.setLocalDescription()");
      return rtcPeerConnection.setLocalDescription(sessionDescription);
    })
    .then(() => {
      // Vanilla ICEの場合は、まだSDPを相手に送らない
      // Trickle ICEの場合は、初期SDPを相手に送る

      if (!isDataChannelOpen(rtcPeerConnection)) {
        // 初期OfferSDPをサーバーを経由して相手に送信
        console.log("- Send OfferSDP to server");
        g_socket.emit("signaling", {
          to: rtcPeerConnection.strRemoteSocketID,
          type: "offer",
          data: rtcPeerConnection.localDescription,
        });
      } else {
        // 初期OfferSDPをDataChannelを通して相手に直接送信
        console.log("- Send OfferSDP through DataChannel");
        rtcPeerConnection.datachannel.send(
          JSON.stringify({
            type: "offer",
            data: rtcPeerConnection.localDescription,
          })
        );
      }
    })
    .catch((error) => {
      console.error("Error : ", error);
    });
}

// OfferSDPの設定とAnswerSDPの作成
function setOfferSDP_and_createAnswerSDP(
  rtcPeerConnection,
  sessionDescription
) {
  console.log("Call : rtcPeerConnection.setRemoteDescription()");
  rtcPeerConnection
    .setRemoteDescription(sessionDescription)
    .then(() => {
      // AnswerSDPの作成
      console.log("Call : rtcPeerConnection.createAnswer()");
      return rtcPeerConnection.createAnswer();
    })
    .then((sessionDescription) => {
      // 作成されたAnswerSDPををLocalDescriptionに設定
      console.log("Call : rtcPeerConnection.setLocalDescription()");
      return rtcPeerConnection.setLocalDescription(sessionDescription);
    })
    .then(() => {
      // Vanilla ICEの場合は、まだSDPを相手に送らない
      // Trickle ICEの場合は、初期SDPを相手に送る

      if (!isDataChannelOpen(rtcPeerConnection)) {
        // 初期AnswerSDPをサーバーを経由して相手に送信
        console.log("- Send AnswerSDP to server");
        g_socket.emit("signaling", {
          to: rtcPeerConnection.strRemoteSocketID,
          type: "answer",
          data: rtcPeerConnection.localDescription,
        });
      } else {
        // 初期AnswerSDPをDataChannelを通して相手に直接送信
        console.log("- Send AnswerSDP through DataChannel");
        rtcPeerConnection.datachannel.send(
          JSON.stringify({
            type: "answer",
            data: rtcPeerConnection.localDescription,
          })
        );
      }
    })
    .catch((error) => {
      console.error("Error : ", error);
    });
}

// AnswerSDPの設定
function setAnswerSDP(rtcPeerConnection, sessionDescription) {
  console.log("Call : rtcPeerConnection.setRemoteDescription()");
  rtcPeerConnection.setRemoteDescription(sessionDescription).catch((error) => {
    console.error("Error : ", error);
  });
}

// ICE candidateの追加
function addCandidate(rtcPeerConnection, candidate) {
  console.log("Call : rtcPeerConnection.addIceCandidate()");
  rtcPeerConnection.addIceCandidate(candidate).catch((error) => {
    console.error("Error : ", error);
  });
}

function device() {
  var ua = navigator.userAgent;
  if (
    ua.indexOf("iPhone") > 0 ||
    ua.indexOf("iPod") > 0 ||
    (ua.indexOf("Android") > 0 && ua.indexOf("Mobile") > 0)
  ) {
    return "mobile";
  } else if (ua.indexOf("iPad") > 0 || ua.indexOf("Android") > 0) {
    return "tablet";
  } else {
    return "desktop";
  }
}

if (device() === "mobile") {
  smartphoneScreen.style.display = "flex";
  syncScreen.style.display = "flex";
} else if (device() === "desktop") {
  desktopScreen.style.visibility = "visible";

  // onsubmitButton_Join();
}

function deviceMotion(e) {
  e.preventDefault();
  let ac = e.acceleration;
  deviceMotionData.x = ac.x;
  deviceMotionData.y = ac.y;
  deviceMotionData.z = ac.z;
}

function deviceOrientation(e) {
  e.preventDefault();
  deviceOrientationData.gamma = e.gamma;
  deviceOrientationData.beta = e.beta;
  deviceOrientationData.alpha = e.alpha;
  SendDeviceInfo();
}

function ClickRequestDeviceSensor() {
  //. ユーザーに「許可」を明示させる必要がある
  DeviceOrientationEvent.requestPermission()
    .then((response) => {
      if (response === "granted") {
        console.log("DeviceOrientationEvent permission granted");
        window.addEventListener("deviceorientation", deviceOrientation);
      } else {
        console.warn("DeviceOrientationEvent permission denied");
      }
    })
    .catch((e) => {
      console.error("DeviceOrientationEvent request failed: ", e);
    });

  DeviceMotionEvent.requestPermission()
    .then((response) => {
      if (response === "granted") {
        console.log("DeviceMotionEvent permission granted");
        window.addEventListener("devicemotion", deviceMotion);
      } else {
        console.warn("DeviceMotionEvent permission denied");
      }
    })
    .catch((e) => {
      console.error("DeviceMotionEvent request failed: ", e);
    });
}

// スマホ（DeviceOrientationEventが取得できるか）判定
if (window.DeviceOrientationEvent) {
  // iOS13かそれ以上かを判定
  console.log("requestPermission");
  if (
    DeviceOrientationEvent.requestPermission &&
    typeof DeviceOrientationEvent.requestPermission === "function"
  ) {
    $("#div_top_screen").css("display", "none");
    var banner =
      '<div id="sensorrequest" onclick="ClickRequestDeviceSensor();"><p id="sensoricon">>></p></div>';
    $("#div_sync_screen").prepend(banner);
  } else {
    window.addEventListener("deviceorientation", deviceOrientation);
  }
}

if (window.DeviceMotionEvent) {
  if (
    DeviceMotionEvent.requestPermission &&
    typeof DeviceMotionEvent.requestPermission === "function"
  ) {
  } else {
    window.addEventListener("devicemotion", deviceMotion);
  }
}

function SendDeviceInfo() {
  // メッセージをDataChannelを通して相手に直接送信
  g_mapRtcPeerConnection.forEach((rtcPeerConnection) => {
    console.log("- Send Message through DataChannel");
    rtcPeerConnection.datachannel.send(
      JSON.stringify({
        type: "message",
        data: {
          deviceMotionData,
          deviceOrientationData,
        },
      })
    );
  });
}
// ブロック崩し
let brickCount,
  hitBrick = false,
  gameState;

class Brick {
  constructor(x, y) {
    this.x = x;
    this.y = y;
    this.width = window.innerWidth / 25;
    this.height = 50;
    this.color = color(random(360), 44, 100);
    this.strokeWeight = 1;
    if (random(1) > 0.9) {
      this.hit = 3;
    } else {
      this.hit = 1;
    }
  }

  show() {
    stroke(0);
    strokeWeight(this.strokeWeight);
    fill(this.color);
    image(brickImage, this.x, this.y, this.width, this.height);
    if (this.hit >= 3) {
      strokeWeight(2);
      line(this.x, this.y, this.x + this.width, this.y + this.height);
    }
    if (this.hit >= 2) {
      strokeWeight(2);
      line(this.x + this.width, this.y, this.x, this.y + this.height);
    }
  }

  checkCollision(ball) {
    if (this.hit > 0) {
      if (
        collideLineCircle(
          this.x,
          this.y,
          this.x + this.width,
          this.y,
          ball.x,
          ball.y,
          ball.size
        )
      ) {
        ball.theta = 2 * PI - ball.theta;

        this.hit--;
      } else if (
        collideLineCircle(
          this.x,
          this.y + this.height,
          this.x + this.width,
          this.y + this.height,
          ball.x,
          ball.y,
          ball.size
        )
      ) {
        ball.theta = 2 * PI - ball.theta;
        this.hit--;
      } else if (
        collideLineCircle(
          this.x,
          this.y,
          this.x,
          this.y + this.height,
          ball.x,
          ball.y,
          ball.size
        )
      ) {
        ball.theta = PI - ball.theta;

        this.hit--;
      } else if (
        collideLineCircle(
          this.x + this.width,
          this.y,
          this.x + this.width,
          this.y + this.height,
          ball.x,
          ball.y,
          ball.size
        )
      ) {
        ball.theta = PI - ball.theta;

        this.hit--;
      }
      hitBrick = this.hit == 0;
      if (this.hit <= 0) {
        brickCount++;
        if (brickCount % 6 == 5) {
          ball.v++;
        }
      }
    } else {
      this.color = color(44, 0, 98, 0);
      this.x = 1000;
      this.y = 1000;
      this.strokeWeight = 0;
    }
  }
}

class Ball {
  constructor() {
    this.x = width / 2;
    this.y = height - 100;
    this.size = 20;
    this.v = 3;
    this.theta = PI / 4;
  }

  show() {
    push();
    fill(182, 0, 85);
    stroke(0);
    strokeWeight(1);
    ellipse(this.x, this.y, this.size);
    pop();
  }

  move() {
    this.x += this.v * cos(this.theta);
    this.y -= this.v * sin(this.theta);
    if (this.x + this.size / 2 >= width) {
      this.theta = PI - this.theta;
      this.x = width - this.size / 2;
    } else if (this.x - this.size / 2 <= 0) {
      this.theta = PI - this.theta;
      this.x = this.size / 2;
    }
    if (this.y + this.size / 2 >= height) {
      gameState = 3;
    }
    if (this.y - this.size / 2 <= 0) {
      this.theta = 2 * PI - this.theta;
    }
  }
}

class Platform {
  constructor() {
    this.width = 100;
    this.height = 15;
    this.x = width / 2 - this.width / 2;
    this.y = height - 50;
    this.time = 0;
  }

  show() {
    push();
    fill(360);
    stroke(0);
    strokeWeight(1.5);
    rect(this.x, this.y, this.width, this.height);
    pop();
  }

  checkCollision(ball) {
    if (
      collideRectCircle(
        this.x,
        this.y,
        this.width,
        this.height * 0.25,
        ball.x,
        ball.y,
        ball.size
      )
    ) {
      let theta =
        ((3 / 4) * PI * (ball.x - this.x)) / this.width + (1 / 8) * PI;
      ball.theta = PI - theta;
    }
  }

  move() {
    if (devicebeta > 0 && this.time > 0 && this.x - 5 >= 0) {
      this.x -= devicebeta / 4;
      this.time = 0;
    } else if (
      devicebeta < 0 &&
      this.time > 0 &&
      this.x + this.width + 5 <= width
    ) {
      this.x -= devicebeta / 4;
      this.time = 0;
      console.log(devicebeta);
    }
    this.time++;
  }
}
