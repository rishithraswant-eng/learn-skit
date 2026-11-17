"""TTS transport completeness checks; fake provider, no external requests."""
import asyncio
import importlib.util
from pathlib import Path
import sys
import tempfile
import types
import unittest

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location('video_build',ROOT/'evs-cat2-content/scripts/video_build.py')
video = importlib.util.module_from_spec(spec)
spec.loader.exec_module(video)

class CompletenessTest(unittest.TestCase):
    def run_stream(self, text, returned):
        class FakeSpeech:
            def __init__(self,*args,**kwargs):
                pass
            async def stream(self):
                yield {'type':'audio','data':b'fake-test-audio'}
                for index, word in enumerate(returned):
                    yield {'type':'WordBoundary','text':word,'offset':index*1000000,'duration':1000000}
        original = sys.modules.get('edge_tts')
        sys.modules['edge_tts'] = types.SimpleNamespace(Communicate=FakeSpeech)
        try:
            with tempfile.TemporaryDirectory() as directory:
                target = Path(directory)
                asyncio.run(video._tts(text,target/'test.mp3',target/'test.words.json'))
                self.assertTrue((target/'test.mp3').exists())
        finally:
            if original is None:
                del sys.modules['edge_tts']
            else:
                sys.modules['edge_tts'] = original

    def test_hyphenated_words(self):
        self.run_stream('In-situ. Ex-situ is off-site.',['In-situ.','Ex-situ','is','off-site.'])

    def test_grouped_acronyms(self):
        text = 'N-P-P equals G-P-P minus respiration, and only N-P-P is available to consumers.'
        self.run_stream(text,text.split())

    def test_truncated_transcript_rejected(self):
        with self.assertRaises(RuntimeError):
            self.run_stream('Conserve water and protect biodiversity.', ['Conserve','water','and','protect'])

if __name__ == '__main__':
    unittest.main()
