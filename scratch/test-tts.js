const googleTTS = require('google-tts-api');

async function test() {
  try {
    const text = "This is a very long string. ".repeat(15);
    console.log("String length:", text.length);
    
    const results = await googleTTS.getAllAudioBase64(text, {
      lang: "en",
      slow: false,
      host: "https://translate.google.com",
    });
    console.log("getAllAudioBase64 success, array length:", results.length);
    console.log("First element:", Object.keys(results[0]));
  } catch (err) {
    console.error("Error with getAllAudioBase64:", err);
  }
}

test();
