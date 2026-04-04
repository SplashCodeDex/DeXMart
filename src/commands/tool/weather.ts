import { MessageContext } from '../../types/index.js';
import axios from 'axios';
import moment from 'moment-timezone';
import z from 'zod';
import { createUrl } from '../../tools/api.js';
import formatters from '../../utils/formatters.js';
import logger from '../../utils/logger.js';

const { convertMsToDuration, ucwords } = formatters;

export default {
  name: 'weather',
  aliases: ['cuaca'],
  category: 'tool',
  permissions: {
    coin: 10,
  },
  code: async (ctx: MessageContext) => {
    const { formatter, config } = ctx.channel.context;

    try {
      const input = ctx.args.join(' ');

      // Validation
      const locationSchema = z.string().min(1, { message: 'Please provide a location.' });
      const validationResult = locationSchema.safeParse(input);
      if (!validationResult.success) {
        return ctx.reply(
          formatter.quote(
            `❎ ${validationResult.error.issues[0].message}\n\nExample: .weather London`
          )
        );
      }
      const location = validationResult.data;

      // API Call
      const apiUrl = createUrl('diibot', '/api/tools/cekcuaca', {
        query: location,
      });
      logger.info(`Weather API URL: ${apiUrl}`);
      const response = await axios.get(apiUrl);
      const { result } = response.data;
      logger.debug(`Weather API result keys: ${result ? Object.keys(result) : 'undefined'}`);

      if (
        !result ||
        !result.name ||
        !result.weather ||
        !Array.isArray(result.weather) ||
        result.weather.length === 0 ||
        !result.main
      ) {
        throw new Error(
          `Weather data not found for "${location}". The API may be down or location invalid. Try another city.`
        );
      }

      const replyText = [
        `Location: ${result.name}, ${result.sys.country}`,
        `Coordinates: ${result.coord.lat}, ${result.coord.lon}`,
        `Last updated: ${moment.unix(result.dt).tz('Africa/Accra').format('DD/MM/YYYY HH:mm')} GMT`,
        '· · ─ ·✶· ─ · ·',
        `Weather: ${ucwords(result.weather[0].description)}`,
        `Temperature: ${result.main.temp}°C (Min ${result.main.temp_min}°C | Max ${result.main.temp_max}°C)`,
        `Feels like: ${result.main.feels_like}°C`,
        `Humidity: ${result.main.humidity}%`,
        `Air Pressure: ${result.main.pressure} hPa`,
        '· · ─ ·✶· ─ · ·',
        `Wind: ${result.wind.speed} m/s (${(result.wind.speed * 3.6).toFixed(1)} km/h)`,
        `Wind Direction: ${result.wind.deg}°`,
        `Wind Gust: ${result.wind.gust || 'N/A'} m/s`,
        '· · ─ ·✶· ─ · ·',
        `Clouds: ${result.clouds.all}%`,
        `Visibility: ${result.visibility ? `${(result.visibility / 1000).toFixed(1)} km` : 'N/A'}`,
        `Sunrise: ${moment.unix(result.sys.sunrise).tz('Africa/Accra').format('HH:mm')} GMT`,
        `Sunset: ${moment.unix(result.sys.sunset).tz('Africa/Accra').format('HH:mm')} GMT`,
      ]
        .map(line => formatter.quote(line))
        .join('\n');

      return ctx.reply({
        text: replyText,
        footer: config.msg.footer,
      });
    } catch (error: any) {
      logger.error('Weather command error:', error);
      return ctx.reply(formatter.quote(`An error occurred: ${error.message}`));
    }
  },
};
