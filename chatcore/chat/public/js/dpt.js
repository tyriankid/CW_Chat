const roomKey = 891011;
const attrKey = 670;

function encryptRoomNum(hosterid, memberid) {

    //1:接收者和发起者id从小到大排序
    var arr = new Array();
    arr.push(hosterid);
    arr.push(memberid);
    arr = arr.sort();
    var roomName = "";
    for (var i = 0; i < arr.length; i++) {
        arr[i] = arr[i] ^ roomKey;
        roomName = roomName + arr[i] + '‎';
    }
    roomName = roomName.substr(0, roomName.length - 1);
    return roomName;
}
//生成加密参数
function encryptRoomAttr(hosterid, memberid) {
    var roomAttr = "";
    roomAttr = roomAttr + (hosterid ^ attrKey) + '‎';
    roomAttr = roomAttr + (memberid ^ attrKey);
    return roomAttr;
}
//生成所有参数
function getChatAttrs(hosterid, memberid) {
    return encryptRoomNum(hosterid, memberid) + '‎' + encryptRoomAttr(hosterid, memberid);
}
//解密房间参数
function decryptRoomAttr(roomattr) {
    var a = roomattr.split('‎');
    var result = new Array();
    for (var i = 0; i < a.length; i++) {
        result.push(a[i] ^ attrKey);
    }
    return result;
}