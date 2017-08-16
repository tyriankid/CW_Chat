//var currentLocalhost = "http://localhost:57738"; //暂定值,以最终服务器域名为准
var currentLocalhost = "http://cwwsc.bigeergeek.com"; //暂定值,以最终服务器域名为准
/*
* post the msgContent & info to storage
* @date       2017-07-19
* @author   HJ
*/
//user message json object to storage
var msgStr = "[]";
var msgarray = eval('(' + msgStr + ')');
function postMsg(chatMsg) {
    //let the message object become to a json
    msgarray.push(chatMsg);
    var messageJson = JSON.stringify(msgarray);
    if (msgarray.length < 1) return false;
    //post the message json to storage
    var data = { messageJson: messageJson} //{ messageJson: JSON.stringify(chatMsg) };
    
    var ajaxUrl = currentLocalhost + "/api/chatHandler.ashx?action=saveChatMessage";
    $.ajax({
        type: 'POST',
        url: ajaxUrl,
        data: data,
        dataType: "json",
        success: function (e) {
            switch (e.state) {
                case 0: //success,then clear the msgarray
                    msgarray.splice(0, msgarray.length);
                    break;
                default:
                    break;
            }
        },
        error: function (e) {
        }
    });
}

/*
* load the history chatroom messageinfos
* isHistory : scroll up and load the messageinfo the day before the latestMsgDate
* @date       2017-07-20
* @author   HJ
*/
var currentMsgDivHeight = 0;
var currentFileNum = -1;
var msgList = new Array();
var loadCount =10; //load message per draw
function loadMsg(isHistory) {
    if (msgList.length >= loadCount && currentFileNum != 0) {
        loadArrayMsg(isHistory);
    } else if (msgList.length < loadCount && currentFileNum != 0) {
        loadAjaxMsg(isHistory);
    } else {
        loadArrayMsg(isHistory);
    }
    
}

//load msg through api and fill the msgList Array
function loadAjaxMsg(isHistory) {
    //get the history message
    var data = { roomId: roomid, fileNum: currentFileNum };
    var ajaxUrl = currentLocalhost + "/api/chatHandler.ashx?action=loadChatMessage";
    $.ajax({
        async: false,
        type: 'get',
        url: ajaxUrl,
        data: data,
        dataType: "json",
        success: function (e) {
            switch (e.state) {
                //if there are msgs
                case 0:
                    for (var i = e.msgInfos.length-1; i >=0 ; i--) {
                        msgList.push(e.msgInfos[i]);
                    }
                    currentFileNum = e.fileNum - 1; //let the msg datafile count reduce 1
                    loadArrayMsg(isHistory); //after push,then show
                    break;
                //there are not msg
                case 1:
                    scrollflag = false; $("[role='loadGif']").hide();
                    break;
                case -1:
                    scrollflag = false; $("[role='loadGif']").hide();
                    addNotice(e.msg);
                    break;
            }
        },
        error: function (e) {
            scrollflag = false; $("[role='loadGif']").hide();
        }
    });
}

//read the msgList Array to show every msg
function loadArrayMsg(isHistory) {
    //if thers is no msg datafile to read,and array has not clear yet,let the loadcount equals the Array length
    if (currentFileNum == 0 && msgList.length <= loadCount) {
        loadCount = msgList.length;
    }
    //if there are more msg datafile to read,and Array length less than the loadcount,get more msgs to the Array.
    if (msgList.length < loadCount && currentFileNum>=1) {
        loadAjaxMsg(isHistory); //this is a recursion
    }
    //show the msgs,and splice the Array after showed.
    for (var k = loadCount - 1; k >= 0; k--) {
        if (!msgList[k]) {
            addMessageElement(isHistory);
            //after msgs showed,splice the msgs that showed
            msgList.splice(0, (loadCount - k)); //当循环没有完毕时,循环数为每页加载数-k
            break;
        }
        
        var hosterHistoryMsg = {
            roomid: msgList[k].roomid,
            userid: msgList[k].userid,
            sendtime: msgList[k].sendtime,
            content: msgList[k].content
        }
        if (msgList[k].userid == user.userid) {
            addChatMessage(user, hosterHistoryMsg, true, isHistory);
        }
        else if (msgList[k].userid == member.userid) {
            addChatMessage(member, hosterHistoryMsg, false, isHistory);
        }
        firstLoadCount++;
        if (k == 0) {
            addMessageElement(isHistory);
            //after msgs showed,splice the msgs that showed
            msgList.splice(0, loadCount); //当循环完毕时,循环次数为每页加载数.
            break;
        }
    }

    $("body")[0].scrollTop = Math.abs(currentMsgDivHeight - $messages.outerHeight()) - 100;
    currentMsgDivHeight = $messages.outerHeight();

    if (msgList.length == 0 && currentFileNum < 1) {
        scrollflag = false;
    } else {
        scrollflag = true;
    }
    
    //$("body")[0].scrollTop = $("body").height();
}

/*
* load the dialogList
* @date       2017-07-28
* @author   HJ
*/
function loadDialogList(userid) {
    //get the history message
    var data = { userid: userid };
    var ajaxUrl = currentLocalhost + "/api/chatHandler.ashx?action=loadDialogList";
    $.ajax({
        type: 'get',
        url: ajaxUrl,
        data: data,
        dataType: "json",
        success: function (e) {
            var locationstr = "userChat.html?k=";
            switch (e.state) {
                case 0:
                    for (var i = 0; i < e.Data.length; i++) {
                        var $chatInfoLi;
                        if (e.Data[i].FQUserId == userid) {
                            $chatInfoLi = $('<li reciverId="' + e.Data[i].JSUserId + '"><a><span class="role">' + e.Data[i].JSRoleInfo + '</span><span class="rolePic"><img src="' + e.Data[i].JSUserHead + '" /></span><span class="roleName">' + e.Data[i].JSUserName + '</span></a></li>');
                            var attrstr = getChatAttrs(e.Data[i].FQUserId, e.Data[i].JSUserId);
                            $chatInfoLi.find("a").attr("href", locationstr + escape(attrstr));
                            //$chatInfoLi.find("a").attr("href", "http://localhost:3000/userChat.html?k=" + compileStr("&hosterid=" + e.Data[i].FQUserId + "&membersid=" + e.Data[i].JSUserId + "&id=" + e.Data[i].RoomNum));
                        }    
                        else{
                            $chatInfoLi = $('<li  reciverId="' + e.Data[i].FQUserId + '"><a><span class="role">' + e.Data[i].FQRoleInfo + '</span><span class="rolePic"><img src="' + e.Data[i].FQUserHead + '" /></span><span class="roleName">' + e.Data[i].FQUserName + '</span></a></li>');
                            var attrstr = getChatAttrs(e.Data[i].JSUserId, e.Data[i].FQUserId);
                            $chatInfoLi.find("a").attr("href", locationstr + escape(attrstr));
                        }
                        //获取当前双方最近一次聊天记录的时间
                        if ((e.Data[i].FQUserId == user.userid && e.Data[i].JSUserId == member.userid) || (e.Data[i].FQUserId == member.userid && e.Data[i].JSUserId == user.userid)) {
                            latestMsgDate = e.Data[i].CreateTime.replace("T"," ");
                        }
                        var $chatList = $(".personList");
                        $chatList.prepend($chatInfoLi);
                    }
                    loadMsg(roomid); //load the history msgs
                    break;
                default:
                    if (e.msg) { addNotice(e.msg);}
                    break;
            }
        },
        error: function (e) {
            
        }
    });
}

