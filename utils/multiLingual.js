// // services/aiTranslate.js
// const OpenAI = require('openai');
// const Groq = require('groq-sdk')

// // const client = new OpenAI({
// //   apiKey: process.env.OPENAI_API_KEY
// // });

// // const LANGS = ["en", "te", "ta", "hi", "ml", "kn"];

// // const translateMulti = async(text) =>{
// //   if (!text || text.trim().length === 0) return null;

// //   const prompt = `
// // Detect the input language and translate the text into:
// // English (en), Telugu (te), Tamil (ta), Hindi (hi), Malayalam (ml), Kannada (kn)

// // Return STRICT JSON only:
// // {
// //   "originalLang": "xx",
// //   "en": "",
// //   "te": "",
// //   "ta": "",
// //   "hi": "",
// //   "ml": "",
// //   "kn": ""
// // }

// // Text:
// // """${text}"""
// // `;

// //   const res = await client.chat.completions.create({
// //     model: "gpt-5-nano",
// //     messages: [{ role: "user", content: prompt }],
// //     temperature: 0
// //   });

// //   return JSON.parse(res.choices[0].message.content);
// // }

// // // services/groqTranslate.js
// // import Groq from "groq-sdk";

// const groq = new Groq({
//   apiKey: process.env.GROQ_API_KEY
// });

// const translateMulti=async(text)=> {
//   if (!text || !text.trim()) return null;

//   const prompt = `
// Detect the language of the input text and translate it into:
// If units like km exist, translate the unit name too.

// - English (en)
// - Telugu (te)
// - Tamil (ta)
// - Malayalam (ml)
// - Hindi (hi)
// - Kannada (kn)

// Return STRICT JSON ONLY in this format:
// {
//   "originalLang": "xx",
//   "en": "",
//   "te": "",
//   "ta": "",
//   "ml": "",
//   "hi": "",
//   "kn": ""
// }

// Text:
// """${text}"""
// `;

//   const completion = await groq.chat.completions.create({
//     model: "openai/gpt-oss-120b",
//     messages: [
//       { role: "user", content: prompt }
//     ],
//     temperature: 0
//   });

//   return JSON.parse(completion.choices[0].message.content);
// }


// module.exports = {translateMulti}
