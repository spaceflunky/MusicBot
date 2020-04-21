var Discord = require("discord.io");
var logger = require("winston");
var auth = require("./auth.json");
var fetch = require("node-fetch");
var he = require("he");

// Configure logger settings
logger.remove(logger.transports.Console);
logger.add(new logger.transports.Console(), {
  colorize: true,
});
logger.level = "debug";

// Initialize Discord Bot
var bot = new Discord.Client({
  token: auth.token,
  autorun: true,
});

bot.on("ready", function (evt) {
  logger.info("Connected");
  logger.info("Logged in as: ");
  logger.info(bot.username + " - (" + bot.id + ")");
});

bot.on("message", function (user, userID, channelID, message, evt) {
  // Our bot needs to know if it will execute a command
  // It will listen for messages that will start with `!red`
  try {
    if (message.substring(0, 4) === "!red") {
      if (message.length === 4) {
        sendDefaultMsg(channelID);
        return;
      }

      if (message.substring(4, 5) !== " ") {
        return;
      }

      var args = message.split(" ").slice(1);
      var cmd = args[0];
      var query = args.slice(1).join(" ");

      switch (cmd) {
        case "top":
          getTopTen(query).then((message) => {
            bot.sendMessage({
              to: channelID,
              message,
            });
          });
          break;
        case "like":
          getSimilarArtists(query).then((message) => {
            bot.sendMessage({
              to: channelID,
              message,
            });
          });
          break;
        default:
          sendDefaultMsg(channelID);
      }
    }
  } catch (error) {
    logger.error(error);
  }
});

var sendDefaultMsg = (channelID) => {
  bot.sendMessage({
    to: channelID,
    message:
      "**Usage:**\n" +
      "Display the top 10: `!red top day|week|all`\n" +
      "See similar artists: `!red like Pink Floyd`",
  });
};

var getSimilarArtists = async (artist) => {
  if (!artist) {
    return "**Usage:**\n`!red like Pink Floyd`";
  }

  const artistURL = auth.red_url + `action=artist&artistname=${artist}`;

  try {
    var response = await fetch(artistURL, {
      headers: {
        Authorization: auth.api_key,
      },
    });

    var data = await response.json();

    if (data.status !== "success") {
      return `Oops! Didn't find an artist named \`${artist}\``;
    }

    const name = he.decode(data.response.name);
    const similarArtists = data.response.similarArtists
      .map((artist) => `* ${he.decode(artist.name)}`)
      .join("\n");

    return `**Artists Similar to \`${name}\`**\n\`\`\`markdown\n${similarArtists}\`\`\``;
  } catch (error) {
    logger.error(error.message);
  }
};

var getTopTen = async (tag) => {
  var url = auth.red_url + "action=top10&limit=100";

  try {
    var response = await fetch(url, {
      headers: {
        Authorization: auth.api_key,
      },
    });

    const data = await response.json();

    if (data.status !== "success") {
      return "Oops! Something's fucky!";
    }

    switch (tag) {
      case "day":
        return generateMsg(data, "day");
      case "week":
        return generateMsg(data, "week");
      case "all":
        return generateMsg(data, "overall");
      default:
        return "**Usage:**\n`!red top day|week|all`";
    }
  } catch (error) {
    logger.error(error.message);
  }
};

var generateMsg = (data, tag) => {
  const albumList = data.response.find((list) => list.tag === tag);
  var index = 0;
  var topTen = [];

  while (topTen.length < 10) {
    const album = albumList.results[index];
    if (!topTen.some((item) => item.groupId === album.groupId)) {
      topTen.push(album);
    }
    index++;
  }

  const topTenList = topTen
    .map((album, index) => formattedResult(index + 1, album))
    .join("\n\n");

  return `**${albumList.caption.replace(
    "Torrents Uploaded",
    "Albums"
  )}**\n\`\`\`markdown\n${topTenList}\`\`\``;
};

var formattedResult = (index, result) => {
  if (result.groupCategory !== 1) {
    return `${index}. ${result.groupName}`;
  }

  const artist = he.decode(result.artist);
  const album = he.decode(result.groupName);
  const year = result.groupYear;
  const tags = result.tags.join(", ");

  return `${index}. ${artist} - ${album} [${year}]\n< ${tags} >`;
};
