
var $window = $(window);
var $inputMessage = $('.inputMessage'); // Input message input box
var $currentInput = $inputMessage.focus();
var $messages = $('#chatArea'); // Messages area
var socket = io();
var connected = false;
var isIdValidate = false;
var isMemberJoin = false;
var currentRoomUserCount = 0;
var roomid = "";
var hosterid = -1;
var membersid = -1;
var FADE_TIME = 350; // ms
var latestMsgDate = "";//最近一次聊天记录日期
var scrollflag = true;
var latestSendTime = ""; //最近一次发送聊天时间

//Initialization user object,if there's more user attrs,add here.
var user = {
    username: '',
    userhead: '',
    userid: -1,
    userrole: '',
    roomid: roomid
};

//接收方
var member = {
    username: '',
    userhead: '',
    userid: -1,
    userrole: '',
    roomid: roomid
}

var message = {
    roomid: roomid,
    userid: -1,
    sendtime: '',
    content: ''
}


    
function getUserInfo() {
    if (!isIdValidate) return false;
    var ajaxUrl = currentLocalhost + "/api/chatHandler.ashx?action=getUserInfoByIds&hosterid=" + hosterid + "&membersid=" + membersid;//+ "&jsoncallback=?";
    $.ajax({
        type: 'get', timeout: 10000,
        async: false,
        url: ajaxUrl,
        dataType: "json",
        success: function (e) {
            if (e.Result == "OK" && e.Count > 1) {
                user.username = e.HosterData[0].UserName;
                user.userhead = e.HosterData[0].UserHead;
                user.userid = e.HosterData[0].UserId;
                user.userrole = e.HosterData[0].roleInfo;
                user.roomid = roomid;
                member.username = e.MemberData[0].UserName;
                member.userhead = e.MemberData[0].UserHead;
                member.userid = e.MemberData[0].UserId;
                member.userrole = e.MemberData[0].roleInfo;
                member.roomid = roomid;
                // Tell the server your username
                socket.emit('add user', user);
                
                loadDialogList(user.userid);
                //set title
                $("title").html(member.username); 
            }
            else {//if userid is not available,open guest mode
                addNotice("非法的参数");
                //loadGuestMode();
            }
        },
        error: function () {
            addNotice("非法的参数");
            //loadGuestMode();
        }
    });

}



//guest mode
function loadGuestMode() {
    user.username = '游客' + Math.ceil(Math.random() * 10000);
    user.userhead = 'http://rd.bigeergeek.com/admin/images/5.png';
    user.userid = -1;
    user.userrole = '游客';
    socket.emit('add user', user);
}

function sendMessage() {
    var msg = $inputMessage.val();
    // Prevent markup from being injected into the message
    msg = cleanInput(msg);
    // if there is a non-empty message and a socket connection
    if (msg && connected) {
        $inputMessage.val('');
        message = {
            roomid: roomid,
            userid: user.userid,
            reciverid: member.userid,
            sendtime: new Date().Format("yyyy-MM-dd hh:mm:ss"),
            content: msg,
            isread: currentRoomUserCount == 2 ? "1" : "0"
        }
        if (Date.parse(new Date()) -Date.parse(latestSendTime) <=100) {
            addNotice("聊天消息发送太快，喝杯茶休息一下吧！");
            return;
        }
        addChatMessage(user, message, true, false); //add chatinfo to chatdiv
        postMsg(message); //post messageinfo to storage
        sendAlert(message); //send alert to user
        // tell server to execute 'new message' and send along one parameter
        socket.emit('new message', user, message);
        latestSendTime = new Date();

        $inputMessage.focus(); //focus after sent
    }
}

function sendWeixinMessage(sender, reciver, message) {
    var data;
    if (user.userid = sender.userid) { //如果发送者是主持者
        data = { hosterid: sender.userid, memberid: reciver.userid};
    } else { //如果发送者不是主持者
        data = { hosterid: reciver.userid, memberid: sender.userid };
    }
    var ajaxUrl = currentLocalhost + "/api/chatHandler.ashx?action=sendWxMessage";
    $.ajax({
        type: 'POST',
        url: ajaxUrl,
        data: data,
        dataType: "json",
        success: function (e) {
            switch (e.state) {
                case 0: 
                    break;
                default:
                    addNotice(e.msg);
                    break;
            }
        },
        error: function (e) {
        }
    });
}

function sendAlert(message) {
    //alert(isMemberJoin);
    //首先判断接收方是否在该房间内,若在,则无需推送
    if (currentRoomUserCount==2) return;

    //发送服务端相应事件,若接收者当前在别的房间,他可以收到消息推送.
    socket.emit('send alert', user, member, message);

    sendWeixinMessage(user, member, message);
}

/*
* Adds the alert from another room effect to chatlist body
* @param    [object]  sender : alert sender 
* @date       2017-07-25
* @author   HJ
*/
var msgCount = 0;
var senderMsgDic = new Dic();
function addAlertMessage(sender, revicer ,message) {
    if (revicer.userid == user.userid) { //receive a new message from other room
        msgCount++;
        var $chatListBtn = $(".xfBox");
        var $countSpan = $("<span role='msgCount'></span>").html(msgCount);
        //1:add a red dot num
        if (msgCount == 1) {
            $chatListBtn.prepend($countSpan);
        } else {
            $("[role='msgCount']") .html(msgCount);
        }
        //2:add an info to chatList
        var userMsgCount = senderMsgDic.get(sender.userid);

        if (userMsgCount) {
            userMsgCount++;
        } else {
            userMsgCount = 1;
        }
        senderMsgDic.set(sender.userid, userMsgCount);
        var $chatInfoLi = $('<li ><a><span class="role">' + sender.userrole + '</span><span class="rolePic"><img src="' + sender.userhead +'" /></span><span class="roleName">' + sender.username + '</span></a><span>（<k senderid="' + sender.userid + '">' + userMsgCount + '</k>条未读消息）</span></li>');
        //$chatInfoLi.find("a").attr("href", "userchat.html?hosterid=" + revicer.userid + "&membersid=" + sender.userid + "&id=" + sender.roomid);
        var locationstr = "userChat.html?k=";
        var attrstr = getChatAttrs(revicer.userid, sender.userid);
        $chatInfoLi.find("a").attr("href", locationstr + escape(attrstr));

        var $chatList = $(".personList");
        if (userMsgCount == 1) { //如果是首次收到消息
            $chatLi = $chatList.find("[reciverId = '" + sender.userid + "']");
            if ($chatLi.length > 0) { //如果该发起人已经在聊天列表内,
                $chatLi.append('<span>（<k senderid="' + sender.userid + '">' + userMsgCount + '</k>条未读消息）</span>');
            } else {
                $chatList.prepend($chatInfoLi);
            }
        } else if (userMsgCount > 1) {
            $chatList.find("[senderid='" + sender.userid + "']").html(userMsgCount);
        }
        console.log("你收到了来自" + sender.username + "的一条在线消息!");
    } else {
        console.log("你收到了来自" + sender.username + "的一条在线消息!但我不是接收者");
    }
    
}

function newDate(datestr) {
    var arr = datestr.split(/[- : \/]/);
    return new Date(arr[0], arr[1] - 1, arr[2], arr[3], arr[4], arr[5]);
}

/*
* Adds the visual chat message to the message list
* @param    [object]  user : currentUserObject 
* @param    [bool]   isMe : Indicate whether the current message is sent from me
* @date       2017-07-13
* @author   HJ
*/
var latestShowNoticeTime = new Date("2009-07-13");
function addChatMessage(user, msg, isMe, isHistory) {
    
    var minute = 1000 * 60;
    var hour = minute * 60;
    var day = hour * 24;
    var halfamonth = day * 15;
    var month = day * 30;
    //默认以规则显示所有时间,如果连续,则不显示时间.
    var dateMsg = newDate(msg.sendtime);

    var dateNow = new Date();
    var difftime = Date.parse(dateNow) - Date.parse(dateMsg);
        
    var monthC = difftime / month;
    var weekC = difftime / (7 * day);
    var dayC = difftime / day;
    var hourC = difftime / hour;
    var minC = difftime / minute;
    //bool:是不是连续消息
    var isQueue = Math.abs(Date.parse(dateMsg) - Date.parse(latestShowNoticeTime)) < 600000;
    //bool:是不是在这周内
    var weekStartDate = formatDate(new Date(dateNow.getFullYear(), dateNow.getMonth(), dateNow.getDate() - dateNow.getDay() + 1));
    var isInThisWeek = Date.parse(dateMsg) - Date.parse(weekStartDate) > 0;
    if (!isQueue && dayC < 1 && dateMsg.getDay() == dateNow.getDay()) {//同一天内
        addNotice(dateMsg.Format("hh:mm"), isHistory); latestShowNoticeTime = newDate(msg.sendtime);
    } else if (!isQueue && dateNow.getDay() - dateMsg.getDay() == 1 && dayC < 2)//昨天
    {
        addNotice("昨天" + dateMsg.Format(" hh:mm"), isHistory); latestShowNoticeTime = newDate(msg.sendtime);
    } else if (!isQueue && dayC > 2 && dateNow.getDay() - dateMsg.getDay() > 1 && isInThisWeek)//前天之外,这周之内
    {
        addNotice("周" + toZhDigit(dateMsg.getDay()) + dateMsg.Format(" hh:mm"), isHistory); latestShowNoticeTime = newDate(msg.sendtime);
    } else if (!isQueue && !isInThisWeek) {
        var timeStr = "";
        var hour = dateMsg.Format("hh");
        if (hour >= 0 && hour < 6) {
            timeStr = "凌晨";
        } else if (hour >= 6 && hour < 12) {
            timeStr = "上午";
        } else if (hour >= 12 && hour < 13) {
            timeStr = "中午";
        } else if (hour >= 13 && hour < 18) {
            timeStr = "下午";
        } else if (hour >= 18 && hour < 24) {
            timeStr = "晚上";
        }
        addNotice(dateMsg.Format("yyyy-MM-dd") + timeStr + dateMsg.Format("hh:mm"), isHistory); latestShowNoticeTime = newDate(msg.sendtime);
    }
        
    var currentChatClass = isMe ? 'right' : 'left';
    var $messageDiv =
        $('<li style="overflow: hidden;"><div role="mainMsgDiv" class="aui-chat-item aui-chat-' + currentChatClass + '" >'
            + '    <div class="aui-chat-inner">'
            + '    <div class="aui-chat-name">' + user.username + '<span class="aui-label aui-label-warning">' + user.userrole + '</span></div>'
            + '<div class="aui-chat-media" >'
            + ' <img src="' + user.userhead + '" />'
            + '</div>'
            + '    <div class="aui-chat-content">'
            + '      <div class="aui-chat-arrow"></div>'
            + msg.content
            + '   </div>'
            + ' </div>'
            + ' </div></li>');
    //addMessageElement($messageDiv, isHistory);

    $historyUl.append($messageDiv);  //暂放到ul内,待提交
    if (!isHistory) {
        addMessageElement(isHistory);
    }
    
}

var $historyUl = $('<ul></ul>');

// Prevents input from having injected markup
function cleanInput(input) {
    return $('<div/>').text(input).text();
}

// Adds a message element to the messages and scrolls to the bottom
var firstLoadCount=0
function addMessageElement(isHistory) {
    $("#main").css({ "height": "32px" });
    //if load history message,append. or prepend
    if (isHistory) {
        /*
        $historyUl.append($el);
        $messages.prepend($historyUl.html());
        $historyUl.html('');
        */
        $messages.prepend($historyUl.html());
        $historyUl.html('');
        //$messages[0].scrollTop = liHeight;
    } else {
        /*
        $el.hide().fadeIn(FADE_TIME); //a fade animation
        $messages.append($el); //append the messageDiv
        */
        $historyUl.hide().fadeIn(FADE_TIME);
        $messages.append($historyUl.html());
        $historyUl.html('');
        
    }
    
    if (firstLoadCount <= loadCount) {
        $("body")[0].scrollTop = $("body").height(); //keep the latest message always jumping out
    }
   
}

var $loadingDiv = $('<div class="dropload-load"  style="text-align:center;color: #999;font-size:12px"><span class="loading"></span>加载中...</div>');
$(function () {
    //server listening functions-------------------------------------------------------------------------------------------------------------------------
    // dropload
    $('#chatArea').dropload({
        scrollArea: window,
        domUp: {
            domClass: 'dropload-up',
            domRefresh: '<div class="dropload-refresh" style="text-align:center;color: #999;font-size:12px">下拉加载...</div>',
            domUpdate: '<div class="dropload-update"  style="text-align:center;color: #999;font-size:12px">释放加载...</div>',
            domLoad: $loadingDiv,
        },
        loadUpFn: function (me) {
            if (!scrollflag) { $loadingDiv.html("没有更多的聊天记录!");me.resetload(); return; }
            setTimeout(function () {
                scrollflag = false;
                loadMsg(true);
                me.resetload();
            }, 300);

        },
        threshold: 50
    });


    //listening login event
    socket.on('login', function (data) {
        currentRoomUserCount = data.roomusercount;
        console.log("当前人数:" + currentRoomUserCount);
        //if reciver not in this room,add an offline notice
        if (currentRoomUserCount < 2 ) {
            addNotice("对方不在线，消息将以微信推送和留言形式转达");
        }
        connected = true;
    });
    // Whenever the server emits 'new message', update the chat body
    socket.on('new message', function (user, msg) {
        addChatMessage(user, msg, false, false);
    });
    // Whenever the server emits 'alert message', update the chatUserList body
    socket.on('alert message', function (sender,reciver,message) {
        addAlertMessage(sender, reciver ,message);
    });
    // Whenever the server emits 'send wxmsg', send the wxmsg to reciver
    socket.on('send wxmsg', function (sender, reciver, message) {
        sendWeixinMessage(sender, reciver, message);
    });
    //when user joined,add a notice
    socket.on('user joined', function (data) {
        if (data.userid == member.userid) { //if reciver comes into current chatroom,ismemberjoin=true
            isMemberJoin = true;
        }
        currentRoomUserCount = data.roomusercount;
        console.log("当前人数:" + currentRoomUserCount);
        addNotice(data.username + "加入了对话");
    });
//when user left,add a notice
    socket.on('user left', function (data) {
        currentRoomUserCount = data.roomusercount;
        console.log("当前人数:" + currentRoomUserCount);
        addNotice(data.username + "离开了对话");
    });


    //effect and tools and eventbinds ------------------------------------------------------------------------------------------------------




    window.onload = function () {
        if (GetQueryString("tp") == "wx") decodeRoomAttr('|');
        else decodeRoomAttr('‎');
        socket.emit('join room', roomid);
        getUserInfo();
    }
    
    $(".fsBtn").click(function () {
        sendMessage();
    });

    $(".xfBox").click(function () {
        msgCount = 0;
        $("[role='msgCount']").remove();
        $(".personList").slideToggle(300);
    })
    $(".inputMessage").focus(function () {
        $(this).css({ "border-bottom": "1px solid #40A700" })
    });
    $(".inputMessage").blur(function () {
        $(this).css({ "border-bottom": "1px solid #c3c3c3" })
    });
    
    $window.keydown(function (event) {
        // Auto-focus the current input when a key is typed
        if (!(event.ctrlKey || event.metaKey || event.altKey)) {
            $currentInput.focus();
        }
        // When the client hits ENTER on their keyboard
        if (event.which === 13) {
            if (user.username) {
                sendMessage();
            }
        }
    });


});

//like wechat, add a message to chat area
function addNotice(msg,isHistory = false) {
    var $noticeDiv = '<div class="noticeBox"><span class="noticeMessage">' + msg + '</span></div>';
    if (isHistory) {
        $historyUl.append($noticeDiv);
    } else {
        $messages.append($noticeDiv);
        $("body")[0].scrollTop = $("body").height();
        //$messages[0].scrollTop = $messages[0].scrollHeight; //keep the latest message always jumping out
    }
}

// 对Date的扩展，将 Date 转化为指定格式的String
// 月(M)、日(d)、小时(h)、分(m)、秒(s)、季度(q) 可以用 1-2 个占位符， 
// 年(y)可以用 1-4 个占位符，毫秒(S)只能用 1 个占位符(是 1-3 位的数字) 
// 例子： 
// (new Date()).Format("yyyy-MM-dd hh:mm:ss.S") ==> 2006-07-02 08:09:04.423 
// (new Date()).Format("yyyy-M-d h:m:s.S")      ==> 2006-7-2 8:9:4.18 
Date.prototype.Format = function (fmt) { //author: meizz 
    var o = {
        "M+": this.getMonth() + 1, //月份 
        "d+": this.getDate(), //日 
        "h+": this.getHours(), //小时 
        "m+": this.getMinutes(), //分 
        "s+": this.getSeconds(), //秒 
        "q+": Math.floor((this.getMonth() + 3) / 3), //季度 
        "S": this.getMilliseconds() //毫秒 
    };
    if (/(y+)/.test(fmt)) fmt = fmt.replace(RegExp.$1, (this.getFullYear() + "").substr(4 - RegExp.$1.length));
    for (var k in o)
        if (new RegExp("(" + k + ")").test(fmt)) fmt = fmt.replace(RegExp.$1, (RegExp.$1.length == 1) ? (o[k]) : (("00" + o[k]).substr(("" + o[k]).length)));
    return fmt;
}

function formatDate(date) {
    var myyear = date.getFullYear();
    var mymonth = date.getMonth() + 1;
    var myweekday = date.getDate();

    if (mymonth < 10) {
        mymonth = "0" + mymonth;
    }
    if (myweekday < 10) {
        myweekday = "0" + myweekday;
    }
    return (myyear + "-" + mymonth + "-" + myweekday);
} 
/**
    * 阿拉伯数字转中文数字,
    * 如果传入数字时则最多处理到21位，超过21位js会自动将数字表示成科学计数法，导致精度丢失和处理出错
    * 传入数字字符串则没有限制
    * @param {number|string} digit
    */
function toZhDigit(digit) {
    digit = typeof digit === 'number' ? String(digit) : digit;
    const zh = ['零', '一', '二', '三', '四', '五', '六', '七', '八', '九'];
    const unit = ['千', '百', '十', ''];
    const quot = ['万', '亿', '兆', '京', '垓', '秭', '穰', '沟', '涧', '正', '载', '极', '恒河沙', '阿僧祗', '那由他', '不可思议', '无量', '大数'];

    let breakLen = Math.ceil(digit.length / 4);
    let notBreakSegment = digit.length % 4 || 4;
    let segment;
    let zeroFlag = [], allZeroFlag = [];
    let result = '';

    while (breakLen > 0) {
        if (!result) { // 第一次执行
            segment = digit.slice(0, notBreakSegment);
            let segmentLen = segment.length;
            for (let i = 0; i < segmentLen; i++) {
                if (segment[i] != 0) {
                    if (zeroFlag.length > 0) {
                        result += '零' + zh[segment[i]] + unit[4 - segmentLen + i];
                        // 判断是否需要加上 quot 单位
                        if (i === segmentLen - 1 && breakLen > 1) {
                            result += quot[breakLen - 2];
                        }
                        zeroFlag.length = 0;
                    } else {
                        result += zh[segment[i]] + unit[4 - segmentLen + i];
                        if (i === segmentLen - 1 && breakLen > 1) {
                            result += quot[breakLen - 2];
                        }
                    }
                } else {
                    // 处理为 0 的情形
                    if (segmentLen == 1) {
                        result += zh[segment[i]];
                        break;
                    }
                    zeroFlag.push(segment[i]);
                    continue;
                }
            }
        } else {
            segment = digit.slice(notBreakSegment, notBreakSegment + 4);
            notBreakSegment += 4;

            for (let j = 0; j < segment.length; j++) {
                if (segment[j] != 0) {
                    if (zeroFlag.length > 0) {
                        // 第一次执行zeroFlag长度不为0，说明上一个分区最后有0待处理
                        if (j === 0) {
                            result += quot[breakLen - 1] + zh[segment[j]] + unit[j];
                        } else {
                            result += '零' + zh[segment[j]] + unit[j];
                        }
                        zeroFlag.length = 0;
                    } else {
                        result += zh[segment[j]] + unit[j];
                    }
                    // 判断是否需要加上 quot 单位
                    if (j === segment.length - 1 && breakLen > 1) {
                        result += quot[breakLen - 2];
                    }
                } else {
                    // 第一次执行如果zeroFlag长度不为0, 且上一划分不全为0
                    if (j === 0 && zeroFlag.length > 0 && allZeroFlag.length === 0) {
                        result += quot[breakLen - 1];
                        zeroFlag.length = 0;
                        zeroFlag.push(segment[j]);
                    } else if (allZeroFlag.length > 0) {
                        // 执行到最后
                        if (breakLen == 1) {
                            result += '';
                        } else {
                            zeroFlag.length = 0;
                        }
                    } else {
                        zeroFlag.push(segment[j]);
                    }

                    if (j === segment.length - 1 && zeroFlag.length === 4 && breakLen !== 1) {
                        // 如果执行到末尾
                        if (breakLen === 1) {
                            allZeroFlag.length = 0;
                            zeroFlag.length = 0;
                            result += quot[breakLen - 1];
                        } else {
                            allZeroFlag.push(segment[j]);
                        }
                    }
                    continue;
                }
            }


            --breakLen;
        }

        return result;
    }
}


/*----外置函数star----*/
var ie = !!window.attachEvent && !window.opera;
var ie9 = ie && (!!+"\v1");
var inputhandler = function (node, fun) {
    if ("oninput" in node) {
        node.oninput = fun;
    } else {
        node.onpropertychange = fun;
    }
    if (ie9) node.onkeyup = fun;
}

/*----外置函数end---*/
var main = document.getElementById("main");
inputhandler(main, function () {
    if (!ie) main.style.height = 32 + "px";
    var height = main.scrollHeight; if (height >= 32) {
        main.style.height = height + "px";
    } else {
        main.style.height = 32 + "px";
    }
});

//get url paras
function GetQueryString(name) {
    var reg = new RegExp("(^|&)" + name + "=([^&]*)(&|$)");
    var r = window.location.search.substr(1).match(reg);
    if (r != null) return unescape(r[2]); return null;
}

function decodeRoomAttr(fgf) {
    var attrs = (GetQueryString('k'));
    var a = attrs.split(fgf);
    var result = new Array();
    for (var i = 0; i < a.length; i++) {
        if (i <= 1)
            result.push(a[i] ^ roomKey);
        else if (i > 1 && i <= 3)
            result.push(a[i] ^ attrKey);
    }
    
    roomid = result[0] + '‎' + result[1];
    hosterid = result[2];
    membersid = result[3];
    if (roomid.indexOf(hosterid) < 0 || roomid.indexOf(membersid) < 0) {
        addNotice("id不匹配"); 
    } else {
        isIdValidate = true;
    }
}



function Dic() {
    this.data = new Array();

    this.set = function (key, value) {
        this.data[key] = value;
    };

    this.get = function (key) {
        return this.data[key];
    };

    this.remove = function (key) {
        this.data[key] = null;
    };

    this.isEmpty = function () {
        return this.data.length == 0;
    };

    this.size = function () {
        return this.data.length;
    };
}


