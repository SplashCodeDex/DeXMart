import { MessageContext } from '../../types/index.js';

export default {
    name: 'goodbye',
    category: 'main',
    description: 'A simple farewell command.',
    code: async (ctx: MessageContext) => {
        await ctx.reply('Goodbye! Have a great day!');
    },
};
