import importlib.util,json,pathlib,tempfile,unittest,struct
spec=importlib.util.spec_from_file_location('importer',pathlib.Path(__file__).with_name('import-hd-media.py'))
module=importlib.util.module_from_spec(spec);spec.loader.exec_module(module)

def gif(size,frames):
    header=b'GIF89a'+struct.pack('<HH',size,size)+bytes([0,0,0])
    frame=b','+struct.pack('<HHHH',0,0,size,size)+bytes([0,2,2,0x44,1,0])
    return header+frame*frames+b';'

class ImportHD(unittest.TestCase):
    def test_animation_structure(self):
        self.assertEqual(module.dimensions(gif(720,2)),(720,720))
        self.assertEqual(module.gif_frames(gif(720,2)),2)
        with self.assertRaises(ValueError):module.gif_frames(gif(720,2)[:-1])

    def test_pack_rejects_low_resolution_static_and_wrong_names(self):
        with tempfile.TemporaryDirectory() as folder:
            root=pathlib.Path(folder)
            # Minimal JPEG SOF data, sufficient to inspect encoded dimensions.
            (root/'a.jpg').write_bytes(b'\xff\xd8\xff\xc0\x00\x0b\x08'+struct.pack('>HH',720,720)+b'\x01\x01\x11\x00')
            source=dict(sourceName='synthetic-test',sourceVersion='1',exercises=[dict(exerciseId='x',nameEn='curl',image='a.jpg',animation='a.gif')])
            path=root/'pack.json';path.write_text(json.dumps(source))
            catalog=[dict(id='x',n='curl'),dict(id='missing',n='other')]
            for size,frames,reason in [(180,2,'below 720'),(720,1,'fewer than two')]:
                (root/'a.gif').write_bytes(gif(size,frames))
                report=module.inspect(path,catalog)[2]
                self.assertFalse(report['complete']);self.assertIn(reason,report['errors'][0]['error'])
            (root/'a.gif').write_bytes(gif(720,2));report=module.inspect(path,catalog)[2]
            self.assertEqual(report['validExercises'],1);self.assertEqual(report['missingIds'],['missing'])
            source['exercises'][0]['nameEn']='different';path.write_text(json.dumps(source))
            self.assertIn('ID/name mismatch',module.inspect(path,catalog)[2]['errors'][0]['error'])

if __name__=='__main__':unittest.main()
