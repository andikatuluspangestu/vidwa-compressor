import React, { useState } from 'react';

const FaqItem: React.FC<{ question: string; answer: string }> = ({ question, answer }) => {
  const [isOpen, setIsOpen] = useState(false);
  return (
    <div className="border-b border-white/10 last:border-b-0">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full text-left py-4 flex justify-between items-center group"
      >
        <span className="text-lg font-medium text-gray-200 group-hover:text-white transition-colors">{question}</span>
        <svg
          className={`w-5 h-5 text-gray-400 transform transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`}
          xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {isOpen && (
        <div className="pb-4 pr-8 text-gray-300">
          <p>{answer}</p>
        </div>
      )}
    </div>
  );
};

const faqData = [
    {
        question: "Is this service free?",
        answer: "Yes, this video compressor is completely free to use. All processing is done directly in your browser, ensuring your data remains private and secure."
    },
    {
        question: "Why are my videos blurry on WhatsApp Status?",
        answer: "WhatsApp applies aggressive compression to videos to save data, which often results in a significant loss of quality. Our tool compresses your video in a way that is optimized for WhatsApp's standards, helping to preserve as much quality as possible."
    },
    {
        question: "What's the ideal size for a WhatsApp Status video?",
        answer: "While there's no official size limit, videos under 16MB are generally recommended for status updates. Our compressor targets a size around 8-10MB by default to ensure a good balance between quality and compatibility."
    },
    {
        question: "Is my data safe?",
        answer: "Absolutely. Your videos are never uploaded to any server. All the magic happens on your own computer using the power of your web browser. Nothing leaves your device."
    },
];

export const Faq: React.FC = () => (
    <div className="w-full max-w-5xl mx-auto mt-12 mb-6">
        <h2 className="text-3xl font-bold text-center text-white mb-6">Frequently Asked Questions</h2>
        <div className="bg-black/20 backdrop-blur-2xl border border-white/10 rounded-2xl p-2 md:p-6">
            {faqData.map((item, index) => (
                <FaqItem key={index} question={item.question} answer={item.answer} />
            ))}
        </div>
    </div>
);