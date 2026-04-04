import { MessageContext } from '../../types/index.js';

export default {
    name: 'hello',
    category: 'main',
    description: 'A simple greeting command.',
    code: async (ctx: MessageContext) => {
        await ctx.reply('Hello! How can I help you today?');
    },
};
