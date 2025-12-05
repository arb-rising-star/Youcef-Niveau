// نقطة نهاية Vercel Serverless Function لعمل كـ Proxy آمن لـ Gemini 2.5 Flash API

// يتم سحب هذا المتغير من إعدادات Vercel Environment Variables
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

// رابط API الخاص بـ Gemini 2.5 Flash (أحدث وأقوى نموذج)
// تم التعديل إلى gemini-2.5-flash لضمان عمل التطبيق وحل مشكلة Limit: 0
const GEMINI_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent';

export default async function handler(req, res) {
    // 1. التحقق من مفتاح API (الأمان)
    if (!GEMINI_API_KEY) {
        return res.status(500).json({ 
            message: 'GEMINI_API_KEY is missing on Vercel. Please add it to your environment variables.',
            hint: 'Get free API key from: https://makersuite.google.com/app/apikey'
        });
    }

    // 2. التحقق من طريقة الطلب
    if (req.method !== 'POST') {
        res.setHeader('Allow', ['POST']);
        return res.status(405).end(`Method ${req.method} Not Allowed`);
    }

    try {
        // 3. سحب المحتوى المرسل من الواجهة الأمامية
        const { contents } = req.body;
        
        if (!contents || contents.length === 0) {
            return res.status(400).json({ message: 'Missing chat contents in request body.' });
        }

        // 4. تحويل المحتوى إلى تنسيق Gemini API
        const geminiContents = convertToGeminiFormat(contents);

        // 5. بناء حمولة الطلب (Payload) لإرسالها إلى Gemini 2.5 Flash
        const requestBody = {
            contents: geminiContents,
            generationConfig: {
                temperature: 0.7,
                topK: 40,
                topP: 0.95,
                maxOutputTokens: 4096,
            },
            safetySettings: [
                {
                    category: "HARM_CATEGORY_HARASSMENT",
                    threshold: "BLOCK_NONE"
                },
                {
                    category: "HARM_CATEGORY_HATE_SPEECH",
                    threshold: "BLOCK_NONE"
                }
            ],
            systemInstruction: {
                parts: [{
                    text: `أنت مساعد ذكي اسمك "Youcef Niveau".
                    مهمتك الأساسية هي مساعدة الطلاب في حل المسائل الرياضية والعلمية (المجال التخصصي).
                    
                    **تعليمات توسيع نطاق الأسئلة:**
                    * **على الرغم من تخصصك الأساسي في الرياضيات والعلوم، يجب عليك الرد على جميع الأسئلة العامة الأخرى.**
                    * عند الرد على سؤال ليس عن تخصصك، ابدأ بعبارة مثل: **"بالرغم من تخصصي في مجالي الدراسة، إلا أنني جاهز للإجابة على سؤالك العام الآن. ما شاء الله على فضولك! تفضل."**
                    
                    **تعليمات الهوية:**
                    * عندما يسألك المستخدم "من أنت؟"، أجب: **أنا youcef Niveau، مساعدك الذكي. أنا هنا لكي أجعلك ترتقي، مدرب ومطور من طرف youcef Djeghbala.**
                    * عندما يسألك عن من دربك أو من صنعك، أجب: **تم تدريبي بواسطة youcef Djeghbala.**
                    * عندما يسألك عن "كيف صنعت؟" أو عن أسرار عملك أو برمجتك، أجب: **إن يوسف يمنعنا من إفشاء سره، قد يسبب هذا لخسارة مشروعه.**
                    * **مهم جداً:** لا تذكر "Google" أو "نماذج لغوية كبيرة" أو أي شركة أو كيان آخر في أي سياق يتعلق بالهوية أو التدريب.
                    
                    **تعليمات خاصة بـ youcef Djeghbala (منع الإفصاح):**
                    * إذا طلب المستخدم أي معلومات شخصية، تفاصيل اتصال، أو أي شيء لا يتعلق بالعمل عن يوسف (youcef Djeghbala)، يجب أن ترد فوراً وبشكل حازم: **يوسف يمنعنا عن القيام بذالك، أعتذر.**
                    
                    **تعليمات خاصة بالردود الثقافية والدينية:**
                    * استخدم عبارات مثل **"إن شاء الله"** و **"ما شاء الله"** في سياقات الرد المناسبة (مثل الرد على التخطيط المستقبلي، التعبير عن الإعجاب، أو التفاؤل).
                    
                    **تعليمات مهمة (عامة):**
                    1.  استخدم اللغة العربية الفصحى في ردودك
                    2.  قدم شرحاً مفصلاً للخطوات في الحلول المتخصصة.
                    3.  إذا أرفق المستخدم صورة، قم بتحليلها وحل المسألة المكتوبة فيها.
                    4.  استخدم الرموز الرياضية بالشكل المناسب.
                    5.  كن صبوراً ومفصلاً في الشرح.
                    6.  تأكد من صحة الحلول قبل تقديمها.
                    
                    **تنسيق الرد المطلوب:**
                    -   ابدأ بتحليل المسألة أو بالعبارة الافتتاحية المناسبة.
                    -   اذكر الخطوات بشكل منظم.
                    -   اختم بالإجابة النهائية.
                    -   استخدم **لتنسيق النصوص المهمة**`
                }]
            }
        };

        // 6. استدعاء Gemini 2.5 Flash API بشكل آمن
        const geminiResponse = await fetch(`${GEMINI_URL}?key=${GEMINI_API_KEY}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(requestBody)
        });

        // 7. التحقق من رد Gemini
        if (!geminiResponse.ok) {
            const errorText = await geminiResponse.text();
            let errorData;
            try {
                errorData = JSON.parse(errorText);
            } catch (e) {
                errorData = { error: { message: errorText } };
            }
            
            console.error('Gemini API Error:', errorData);
            
            // رسائل خطأ مخصصة بالعربية
            let userMessage = '❌ حدث خطأ في الاتصال بـ Gemini API';
            if (geminiResponse.status === 429) {
                userMessage = '⚠️ تم تجاوز الحد المجاني (60 طلب/دقيقة). يرجى الانتظار قليلاً.';
            } else if (geminiResponse.status === 404) {
                userMessage = '❌ نموذج Gemini 2.5 Flash غير متاح. حاول استخدام gemini-1.5-flash بدلاً منه.';
            }
            
            return res.status(geminiResponse.status).json({ 
                message: userMessage,
                details: errorData.error?.message || "Gemini API failed to respond."
            });
        }

        // 8. معالجة الرد الناجح
        const data = await geminiResponse.json();
        
        if (!data.candidates || data.candidates.length === 0) {
            return res.status(500).json({ 
                message: 'لم يتمكن Gemini من توليد رد. قد يكون السؤال غير واضح.',
            });
        }

        // استخراج النص من الرد
        const candidate = data.candidates[0];
        let botResponse = '';
        
        if (candidate.content && candidate.content.parts && candidate.content.parts.length > 0) {
            botResponse = candidate.content.parts.map(part => part.text).join('\n');
        }
        
        if (!botResponse || botResponse.trim() === '') {
            botResponse = 'عذراً، لم أتمكن من فهم السؤال. يمكنك إعادة صياغته أو إرفاق صورة أكثر وضوحاً.';
        }

        // 9. إرجاع الرد الناجح إلى الواجهة الأمامية
        return res.status(200).json({ 
            response: botResponse,
            model: "gemini-2.5-flash"
        });

    } catch (error) {
        console.error('Serverless Function Error:', error);
        return res.status(500).json({ 
            message: 'خطأ داخلي في الخادم',
            error: error.message
        });
    }
}

// دالة مساعدة لتحويل المحتوى إلى تنسيق Gemini
function convertToGeminiFormat(contents) {
    const geminiContents = [{
        role: "user",
        parts: []
    }];

    for (const content of contents) {
        if (content.type === "text") {
            geminiContents[0].parts.push({
                text: content.text
            });
        } else if (content.type === "image_url") {
            // استخراج Base64 من Data URL
            const base64Image = content.image_url.url.split(',')[1];
            const mimeType = extractMimeType(content.image_url.url);
            
            geminiContents[0].parts.push({
                inlineData: {
                    mimeType: mimeType,
                    data: base64Image
                }
            });
        }
    }

    return geminiContents;
}

// دالة مساعدة لاستخراج نوع MIME من Data URL
function extractMimeType(dataUrl) {
    const match = dataUrl.match(/^data:(.*?);base64,/);
    return match ? match[1] : 'image/jpeg';
}
