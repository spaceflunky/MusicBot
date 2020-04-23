var Discord = require("discord.io");
var logger = require("winston");
var fetch = require("node-fetch");
var auth = process.env.NODE_ENV === "dev" ? require("./auth.json") : null;
var he = require("he");
var sanitize = require("sanitize-html");

// Configure logger settings
logger.remove(logger.transports.Console);
logger.add(new logger.transports.Console(), {
  colorize: true,
});
logger.level = "debug";

// Set some constants
const bot_token =
  process.env.NODE_ENV === "dev"
    ? auth.discord_bot_token
    : process.env.discord_bot_token;
const red_api_key =
  process.env.NODE_ENV === "dev" ? auth.red_api_key : process.env.red_api_key;
const red_url =
  process.env.NODE_ENV === "dev" ? auth.red_url : process.env.red_url;
const lastfm_api_key =
  process.env.NODE_ENV === "dev"
    ? auth.lastfm_api_key
    : process.env.lastfm_api_key;
const lastfm_url = "https://ws.audioscrobbler.com/2.0/";

// Initialize Discord Bot
var bot = new Discord.Client({
  token: bot_token,
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
    if (evt.d.mentions.some((mention) => mention.id === bot.id)) {
      if (message.includes("thank")) {
        bot.sendMessage({
          to: channelID,
          message: `You're welcome <@${userID}>`,
        });
      } else if (message.includes("help")) {
        sendDefaultMsg(channelID, undefined, userID);
      } else {
        bot.sendMessage({
          to: channelID,
          message: `I love you <@${userID}>`,
        });
      }
    } else if (message.substring(0, 1) === "!") {
      var cmd = message.split(" ")[0];
      var args = message.split(" ").slice(1);

      switch (cmd) {
        case "!artist":
          var artist = args.join(" ");
          if (!artist) {
            bot.sendMessage({
              to: channelID,
              message: "**Usage:**\n`!artist pink floyd`",
            });
            break;
          }

          bot.simulateTyping(channelID, () => {
            getLastFMArtistInfo(artist).then((message) => {
              bot.sendMessage({
                to: channelID,
                message,
              });
            });
          });
          break;
        case "!red":
          var query = args[0];
          var params = args.slice(1);

          switch (query) {
            case "artist":
              var artist = params.join(" ");

              if (!artist) {
                bot.sendMessage({
                  to: channelID,
                  message: "**Usage:**\n`!red artist pink floyd`",
                });
                break;
              }

              bot.simulateTyping(channelID, (error, response) => {
                getREDArtistInfo(artist).then((message) => {
                  bot.sendMessage({
                    to: channelID,
                    message,
                  });
                });
              });
              break;
            case "top":
              var period = params[0];

              if (!period) {
                bot.sendMessage({
                  to: channelID,
                  message: "**Usage:**\n`!red top day|week|all`",
                });
                break;
              }

              bot.simulateTyping(channelID, () => {
                getTopTen(period).then((message) => {
                  bot.sendMessage({
                    to: channelID,
                    message,
                  });
                });
              });
              break;
            case "like":
              var artist = params.join(" ");

              if (!artist) {
                bot.sendMessage({
                  to: channelID,
                  message: "**Usage:**\n`!red like Pink Floyd`",
                });
                break;
              }

              bot.simulateTyping(channelID, () => {
                getSimilarArtists(artist).then((message) => {
                  bot.sendMessage({
                    to: channelID,
                    message,
                  });
                });
              });
              break;
            default:
              sendDefaultMsg(channelID, cmd);
          }
          break;
      }
    }
  } catch (error) {
    logger.error(error.message);
  }
});

var sendDefaultMsg = (channelID, cmd, userId) => {
  var message = userId ? `<@${userId}>\n` : "";
  message += "**Usage:**\n";

  switch (cmd) {
    case "!red":
      message +=
        "Display the RED top 10: `!red top day|week|all`\n" +
        "See similar artists on RED: `!red like Pink Floyd`";
      break;
    case "!artist":
      message += "Get artist info from last.fm: `!artist Pink Floyd`";
      break;
    default:
      message +=
        "Display the RED top 10: `!red top day|week|all`\n" +
        "See similar artists on RED: `!red like Pink Floyd`\n" +
        "Get artist info from last.fm: `!artist Pink Floyd`";
      break;
  }

  bot.sendMessage({
    to: channelID,
    message,
  });
};

var getREDArtistInfo = async (artist) => {
  if (!artist) {
    return "**Usage:**\n`!red artist Pink Floyd`";
  }

  const artistURL = red_url + `action=artist&artistname=${artist}`;

  try {
    var response = await fetch(artistURL, {
      headers: {
        Authorization: red_api_key,
      },
    });

    var data = await response.json();

    if (data.status !== "success") {
      return `Oops! Didn't find an artist named \`${artist}\``;
    }

    var { name, image, body, tags } = data.response;
    name = he.decode(name);
    body = sanitize(body, { allowedTags: [] });
    if (body.length > 500) {
      body = body.substring(0, 500) + "[...]";
    }
    if (body.length === 0) {
      body = `No description available for ${name}`;
    }

    tags = tags
      .sort((tagA, tagB) =>
        tagA.count > tagB.count ? -1 : tagA.count < tagB.count ? 1 : 0
      )
      .slice(0, 6)
      .map((tag) => tag.name)
      .join(", ");

    var message = `**RED Info on \`${name}\`**\n${image}\n\`\`\`markdown\n${body}\n\n< ${tags} >\n\`\`\``;

    return message;
  } catch (error) {
    logger.error(error.message);
  }
};

var getSimilarArtists = async (artist) => {
  if (!artist) {
    return "**Usage:**\n`!red like Pink Floyd`";
  }

  const artistURL = red_url + `action=artist&artistname=${artist}`;
  try {
    var response = await fetch(artistURL, {
      headers: {
        Authorization: red_api_key,
      },
    });

    var data = await response.json();

    if (data.status !== "success") {
      return `Oops! Didn't find an artist named \`${artist}\``;
    }

    const name = he.decode(data.response.name);

    var similarArtists = data.response.similarArtists;

    if (similarArtists.length === 0) {
      return `Wow. There are no similar artists to \`${name}\`. They are truly unique.`;
    }

    similarArtists = similarArtists
      .map((artist) => `* ${he.decode(artist.name)}`)
      .join("\n");

    return `**Artists Similar to \`${name}\`**\n\`\`\`markdown\n${similarArtists}\`\`\``;
  } catch (error) {
    logger.error(error.message);
  }
};

var getTopTen = async (tag) => {
  var url = red_url + "action=top10&limit=100";

  try {
    var response = await fetch(url, {
      headers: {
        Authorization: red_api_key,
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

var getLastFMArtistInfo = async (artist) => {
  const artistInfoUrl =
    lastfm_url +
    `?method=artist.getinfo&artist=${artist}&api_key=${lastfm_api_key}&format=json`;
  const topTagsUrl =
    lastfm_url +
    `?method=artist.gettoptags&artist=${artist}&api_key=${lastfm_api_key}&format=json`;

  try {
    var artistInfoResponse = await fetch(artistInfoUrl);
    var artistInfoData = await artistInfoResponse.json();
    var artistTopTagsResponse = await fetch(topTagsUrl);
    var artistTopTagsData = await artistTopTagsResponse.json();

    if (artistInfoData.error) {
      if (data.error === 6) {
        return `Oops! I couldn't find an arist named \`${artist}\`, ya dingus.`;
      } else {
        return `Oops! Something's fucky. Did you *break* me?!`;
      }
    }

    var name = artistInfoData.artist.name;
    var artistUrl = artistInfoData.artist.url;
    var bio = sanitize(artistInfoData.artist.bio.summary, { allowedTags: [] });
    var tags = artistTopTagsData.toptags.tag
      .filter((tag) => tag.name !== "seen live")
      .map((tag) => tag.name)
      .slice(0, 6)
      .join(", ");

    var message = `**Info for \`${name}\`**\nFrom Last.fm: <${artistUrl}>\`\`\`markdown\n${bio}\n\n< ${tags} >\`\`\``;

    return message;
  } catch (error) {
    logger.error(error.message);
  }
};
