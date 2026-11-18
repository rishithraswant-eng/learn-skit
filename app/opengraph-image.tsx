import { ImageResponse } from 'next/og';

export const runtime = 'edge';
export const alt = 'learn-skit — FAT revision for EVS, Quant & Qual';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default async function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          padding: '60px 80px',
          background: 'linear-gradient(145deg, #1B2440 0%, #121626 100%)',
          color: '#FFFFFF',
          fontFamily: 'sans-serif',
          border: '2px solid #2A365D',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '18px' }}>
            <svg width="48" height="48" viewBox="0 0 32 32">
              <path d="M16 3c7 0 13 5 13 12s-5 14-13 14S3 23 3 16 9 3 16 3z" fill="#F5B69E" />
              <circle cx="12" cy="12" r="5" fill="#8DB9F0" />
            </svg>
            <span style={{ fontSize: '36px', fontWeight: 800, color: '#F6F5FD', letterSpacing: '-0.5px' }}>
              learn-skit
            </span>
          </div>
          <div
            style={{
              padding: '6px 18px',
              borderRadius: '20px',
              background: '#263259',
              border: '1px solid #8DB9F0',
              color: '#8DB9F0',
              fontSize: '18px',
              fontWeight: 700,
            }}
          >
            FAT REVISION
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <h1
            style={{
              fontSize: '56px',
              fontWeight: 800,
              margin: 0,
              lineHeight: 1.15,
              color: '#FFFFFF',
              letterSpacing: '-1px',
            }}
          >
            Revise what the exam actually asks.
          </h1>
          <p style={{ fontSize: '32px', color: '#F5B69E', margin: 0, fontWeight: 700 }}>
            EVS · Quant · Qual
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div
            style={{
              padding: '10px 20px',
              borderRadius: '16px',
              background: '#222C4E',
              border: '1px solid #354377',
              color: '#8DB9F0',
              fontSize: '18px',
              fontWeight: 700,
            }}
          >
            EVS Flashcards
          </div>
          <div
            style={{
              padding: '10px 20px',
              borderRadius: '16px',
              background: '#222C4E',
              border: '1px solid #354377',
              color: '#8DB9F0',
              fontSize: '18px',
              fontWeight: 700,
            }}
          >
            Predicted MCQs
          </div>
          <div
            style={{
              padding: '10px 20px',
              borderRadius: '16px',
              background: '#222C4E',
              border: '1px solid #354377',
              color: '#8DB9F0',
              fontSize: '18px',
              fontWeight: 700,
            }}
          >
            Quant &amp; Qual Practice
          </div>
          <div
            style={{
              padding: '10px 20px',
              borderRadius: '16px',
              background: '#222C4E',
              border: '1px solid #354377',
              color: '#F5B69E',
              fontSize: '18px',
              fontWeight: 700,
            }}
          >
            6-Min Cheat Sheets
          </div>
        </div>
      </div>
    ),
    { ...size }
  );
}
