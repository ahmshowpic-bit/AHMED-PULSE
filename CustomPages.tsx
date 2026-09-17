import React from 'react';
import { CustomPage, TabId } from '../types';

interface CustomPagesProps {
  activeTab: TabId;
  customPages: CustomPage[];
}

const CustomPages: React.FC<CustomPagesProps> = ({ activeTab, customPages }) => {
  return (
    <>
      {customPages.map(page => (
        <section key={page.id} className={`${activeTab === page.id ? 'block' : 'hidden'}`}>
          <h2 className="text-4xl font-black mb-12 mt-8 border-r-8 border-cyan-400 pr-6">{page.title}</h2>
          <div
            className="glass border border-white/10 p-10 md:p-16 rounded-[4rem] leading-relaxed prose prose-invert max-w-none text-xl shadow-2xl"
            dangerouslySetInnerHTML={{ __html: page.content }}
          />
        </section>
      ))}
    </>
  );
};

export default React.memo(CustomPages);
