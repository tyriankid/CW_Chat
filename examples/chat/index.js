// Setup basic express server
var express = require('express');
var app = express();
var server = require('http').createServer(app);
var io = require('../..')(server);
var port = process.env.PORT || 3000;


server.listen(port, function () {
  console.log('Server listening at port %d', port);
});

// Routing
app.use(express.static(__dirname + '/public'));

//if anyone join or change or leave a chatroom,update the current roomname to this dictionary
var UserCurrentInfoArray = new Dic(); 
//if anyone join or change or leave a chatroom,update the current room usercount to this dictionary
var RoomCurrentUsercountArray = new Dic();


io.on('connection', function (socket) {
    var roomName = '';
    socket.on('join room', function (roomname) {
        if (!roomname) { console.log("username incorrect ,stopping create room."); return false; }
        socket.join(roomname, () => {
            let rooms = Object.keys(socket.rooms);
            // [ <socket.id>, 'room 237' ]
        });
        roomName = roomname;
    });

  var addedUser = false;
    

  // when the client emits 'new message', this listens and executes
  socket.on('new message', function (user,msg) {
      // we tell the client to execute 'new message'
      socket.to(user.roomid).emit('new message', user, msg);
  });


  // when the client emits 'send alert',check the UserCurrentInfoArray,if matchs the id,send alert to his room
  socket.on('send alert', function (sender, reciver, message) {
      var reciverCurrentRoomId = UserCurrentInfoArray.get(reciver.userid);
      if (reciverCurrentRoomId && reciverCurrentRoomId != sender.roomid) {
          //if matchs, send alert message in chatroom
          
          socket.to(reciverCurrentRoomId).emit('alert message', sender, reciver, message);
          console.log("reciver online but not in this room, send alert to him");
      } else {
          //if not matchs any room,means reciver is not online,then send a weixin msg
          socket.to(sender.roomid).emit('send wxmsg', sender, reciver, message);
          console.log("reciver not in any chat room,send weixin msg to room:" + sender.roomid);
      }
  });




  // when the client emits 'add user', this listens and executes
  socket.on('add user', function (user) {
      if (addedUser) return;
      //set currentUser Chatroom
      UserCurrentInfoArray.set(user.userid, user.roomid);
      //set currentRoom Usercount
      var currentRoomUserCount = RoomCurrentUsercountArray.get(user.roomid);
      console.log("room " + user.roomid+" before user add:"+RoomCurrentUsercountArray.get(user.roomid));
      if (currentRoomUserCount && currentRoomUserCount >= 0) {
          currentRoomUserCount++;
          RoomCurrentUsercountArray.set(user.roomid, currentRoomUserCount);
      } else {
          //set current room usercount to 0 
          RoomCurrentUsercountArray.set(user.roomid, 1);
          currentRoomUserCount = 1;
      }
      console.log("room " + user.roomid + " after user add:" + currentRoomUserCount);

      //store the username in the socket session for this client
      socket.username = user.username;
      socket.headimg = user.userhead;
      socket.userid = user.userid;
      socket.userrole = user.userrole;
      socket.roomid = user.roomid;
      addedUser = true;
      socket.emit('login', {
          roomusercount: currentRoomUserCount
    });
    // echo globally (all clients) that a person has connected
    socket.to(user.roomid).emit('user joined', {
        username: socket.username,
        userid: socket.userid,
        roomusercount: currentRoomUserCount
    });
  });




  // when the user disconnects.. perform this
  socket.on('disconnect', function () {
      if (addedUser) {
          //set currentRoom usercount = usercount-1
          var leftRoomId = UserCurrentInfoArray.get(socket.userid);
          var leftRoomUserCount = RoomCurrentUsercountArray.get(leftRoomId);
          console.log("room " + leftRoomId + " befor disconnect:" + leftRoomUserCount);
          leftRoomUserCount = leftRoomUserCount - 1;
          RoomCurrentUsercountArray.set(leftRoomId, leftRoomUserCount);
          console.log("room " + leftRoomId + " after disconnect:" + leftRoomUserCount);
          
          //remove user current room,to be offline
          UserCurrentInfoArray.remove(socket.userid);
         // echo globally that this client has left
          socket.to(roomName).emit('user left', {
              username: socket.username,
              userid: socket.userid,
              roomusercount: leftRoomUserCount
      });
    }
  });
});



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
