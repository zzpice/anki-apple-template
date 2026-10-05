"""从网页实际导出函数到官方 Anki 文本导入、构包和更新。"""
import base64
import copy
import json
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest
import zipfile

from anki.collection import Collection
from anki.import_export_pb2 import ImportAnkiPackageRequest, ImportCsvRequest

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'scripts'))
import build_package as package
from authoring import read_workspace


class AuthoringTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.temp = tempfile.TemporaryDirectory()
        cls.directory = Path(cls.temp.name)
        subprocess.run(['node', str(package.ROOT / 'tests/authoring_fixture.mjs'), str(cls.directory)], check=True)
        cls.source = cls.directory / 'workspace.json'
        cls.data = json.loads(cls.source.read_text())
        cls.apkg = cls.directory / 'custom.apkg'
        cls.preview = cls.directory / 'cards.json'
        package.build_package(cls.apkg, cls.preview, timestamp=1800000000, workspace=cls.source)

    @classmethod
    def tearDownClass(cls):
        cls.temp.cleanup()

    def collection(self, source):
        temp = tempfile.TemporaryDirectory()
        self.addCleanup(temp.cleanup)
        collection = Collection(str(Path(temp.name) / 'collection.anki2'))
        self.addCleanup(collection.close)
        collection.import_anki_package(ImportAnkiPackageRequest(package_path=str(source)))
        collection.models._clear_cache()
        return collection

    def check_notes(self, collection):
        specs = {s['key']: s for s in package.specifications()}
        for source in self.data['notes']:
            nid = collection.db.scalar('select id from notes where guid=?', source['guid'])
            self.assertIsNotNone(nid)
            note = collection.get_note(nid)
            self.assertEqual(note.mid, specs[source['type']]['id'])
            self.assertEqual(note.fields, list(source['fields'].values()))
            self.assertEqual(set(note.tags), set(source['tags']))
            self.assertTrue(all(c.did == collection.decks.id_for_name(self.data['deck']) for c in note.cards()))
        media = self.data['media'][0]
        self.assertEqual((Path(collection.media.dir()) / media['name']).read_bytes(), base64.b64decode(media['data'].split(',')[1]))
        io = next(n for n in self.data['notes'] if n['type'] == 'occlusion')
        nid = collection.db.scalar('select id from notes where guid=?', io['guid'])
        native = collection._backend.get_image_occlusion_note(nid).note
        self.assertEqual(native.image_file_name, media['name'])
        self.assertEqual(sorted(o.ordinal for o in native.occlusions), [1, 3])
        self.assertEqual(sum(len(o.shapes) for o in native.occlusions), 3)
        model = collection.models.get(specs['occlusion']['id'])
        self.assertEqual(model['originalStockKind'], 6)
        self.assertEqual([f['tag'] for f in model['flds']], [0, 1, 2, 3, 4])

    def test_json_package_native_preview_and_update(self):
        collection = self.collection(self.apkg)
        self.assertEqual(collection.note_count(), 7)
        self.assertEqual(collection.card_count(), 11)
        self.check_notes(collection)
        _, records, _ = read_workspace(self.source, package.specifications(), package.media_names())
        self.assertEqual(package.preview_data(collection, records), json.loads(self.preview.read_text()))
        cid = collection.find_cards('')[0]
        card = collection.get_card(cid)
        card.type, card.queue, card.ivl, card.reps, card.due = 2, 2, 21, 8, 33
        collection.update_card(card)
        updated = copy.deepcopy(self.data)
        updated['notes'][0]['fields']['解析'] = '更新后仍保留排程'
        path = self.directory / 'updated.json'
        path.write_text(json.dumps(updated, ensure_ascii=False))
        apkg = self.directory / 'updated.apkg'
        package.build_package(apkg, None, timestamp=1800001000, workspace=path)
        collection.import_anki_package(ImportAnkiPackageRequest(package_path=str(apkg)))
        collection.import_anki_package(ImportAnkiPackageRequest(package_path=str(apkg)))
        self.assertEqual(collection.note_count(), 7)
        self.assertEqual(collection.card_count(), 11)
        note = collection.get_note(collection.db.scalar('select id from notes where guid=?', updated['notes'][0]['guid']))
        self.assertEqual(note['解析'], '更新后仍保留排程')
        card = collection.get_card(cid)
        self.assertEqual((card.type, card.queue, card.ivl, card.reps, card.due), (2, 2, 21, 8, 33))

    def test_zip_and_native_tsv_roundtrip(self):
        collection = self.collection(package.OUTPUT)
        with zipfile.ZipFile(self.directory / 'export.zip') as archive:
            self.assertIsNone(archive.testzip())
            self.assertEqual(json.loads(archive.read('workspace.json')), self.data)
            media = self.data['media'][0]
            self.assertEqual(archive.read('media/' + media['name']), base64.b64decode(media['data'].split(',')[1]))
            collection.media.write_data(media['name'], archive.read('media/' + media['name']))
            for spec in package.specifications():
                path = self.directory / (spec['key'] + '.tsv')
                self.assertEqual(archive.read(spec['name'] + '.tsv'), path.read_bytes())
                metadata = collection.get_csv_metadata(str(path), None)
                self.assertTrue(metadata.is_html)
                self.assertEqual(metadata.global_notetype.id, spec['id'])
                self.assertEqual(list(metadata.global_notetype.field_columns), list(range(1, len(spec['fields']) + 1)))
                self.assertEqual(metadata.guid_column, len(spec['fields']) + 3)
                result = collection.import_csv(ImportCsvRequest(path=str(path), metadata=metadata))
                self.assertEqual(result.log.found_notes, len([n for n in self.data['notes'] if n['type'] == spec['key']]))
        self.assertEqual(collection.note_count(), 16)
        self.assertEqual(collection.card_count(), 25)
        self.check_notes(collection)
        cid = collection.db.scalar('select c.id from cards c join notes n on c.nid=n.id where n.guid=?', self.data['notes'][0]['guid'])
        card = collection.get_card(cid)
        card.queue, card.type, card.reps = 2, 2, 10
        collection.update_card(card)
        path = self.directory / 'basic.tsv'
        path.write_text(path.read_text().replace('domain: www.example.cn', 'updated: www.example.cn'))
        metadata = collection.get_csv_metadata(str(path), None)
        collection.import_csv(ImportCsvRequest(path=str(path), metadata=metadata))
        self.assertEqual(collection.note_count(), 16)
        self.assertEqual(collection.get_card(cid).reps, 10)
        self.assertIn('updated:', collection.get_note(collection.get_card(cid).nid)['解析'])

    def test_invalid_input_and_protected_outputs(self):
        cases = []
        for mutate in [
            lambda d: d['notes'][0].update(type='unknown'),
            lambda d: d['notes'][0]['fields'].update(自定义='不属于类型'),
            lambda d: d['notes'][1].update(guid=d['notes'][0]['guid']),
            lambda d: d['notes'][0]['fields'].update(答案='<img src="https://example.com/private">'),
            lambda d: d['notes'][0]['fields'].update(答案='<img src=x onerror="alert(1)">'),
            lambda d: d['notes'][0]['fields'].update(答案='<a href="java&#115;cript:alert(1)">x</a>'),
            lambda d: d['notes'][0]['fields'].update(答案='<div style="background:url(https://example.com)">x</div>'),
            lambda d: d['notes'][0]['fields'].update(答案='<img title="1 < 2" src="https://example.invalid/a.png">'),
            lambda d: d['notes'][0]['fields'].update(答案='<img src="_rule-build.svg" onerror="if (1 < 2) alert(1)">'),
            lambda d: d['notes'][0]['fields'].update(答案='<a title="x > y" href="javascript:alert(1)">x</a>'),
            lambda d: d['notes'][0]['fields'].update(答案='<img alt="没有文件名">'),
            lambda d: d['notes'][0]['fields'].update(答案='<image src="https://example.invalid/a.png">'),
            lambda d: d['media'][0].update(name='../escape.png'),
            lambda d: d['media'][0].update(name='at-' + '0' * 32 + '.png'),
            lambda d: d['media'][0].update(data='data:image/png;base64,aW52YWxpZA=='),
            lambda d: d.update(deck='空层级::::名字'),
        ]:
            data = copy.deepcopy(self.data); mutate(data); cases.append(data)
        path = self.directory / 'invalid.json'
        for data in cases:
            path.write_text(json.dumps(data))
            with self.assertRaises(ValueError):
                read_workspace(path, package.specifications(), package.media_names())
        data = copy.deepcopy(self.data)
        next(n for n in data['notes'] if n['type'] == 'cloze')['fields']['正文'] = '没有原生挖空'
        path.write_text(json.dumps(data))
        with self.assertRaises(ValueError):
            package.build_package(self.directory / 'invalid.apkg', None, workspace=path)
        for output, preview in [(package.OUTPUT, None), (package.PREVIEW, None), (self.directory / 'ok.apkg', package.OUTPUT), (self.directory / 'ok.apkg', package.PREVIEW), (self.source, None), (self.directory / 'ok.apkg', self.source)]:
            with self.assertRaises(ValueError):
                package.build_package(output, preview, workspace=self.source)

    def test_native_package_preserves_optional_empty_mindmap_title(self):
        data = copy.deepcopy(self.data)
        source = next(n for n in data['notes'] if n['type'] == 'mindmap')
        source['fields']['标题'] = ''
        path = self.directory / 'untitled.json'
        path.write_text(json.dumps(data, ensure_ascii=False))
        apkg = self.directory / 'untitled.apkg'
        package.build_package(apkg, None, workspace=path)
        collection = self.collection(apkg)
        note = collection.get_note(collection.db.scalar('select id from notes where guid=?', source['guid']))
        self.assertEqual(note['标题'], '')
        self.assertEqual(len(note.cards()), 2)
        self.assertEqual(collection.note_count(), 7)

    def test_local_image_with_quoted_angle_brackets_roundtrips(self):
        data = copy.deepcopy(self.data)
        source = data['notes'][0]
        source['fields']['答案'] = '<img title="1 < 2 > 0" src="' + data['media'][0]['name'] + '">'
        path = self.directory / 'quoted.json'
        path.write_text(json.dumps(data, ensure_ascii=False))
        apkg = self.directory / 'quoted.apkg'
        package.build_package(apkg, None, workspace=path)
        collection = self.collection(apkg)
        note = collection.get_note(collection.db.scalar('select id from notes where guid=?', source['guid']))
        self.assertEqual(note.fields, list(source['fields'].values()))
        self.assertIn(source['fields']['答案'], note.cards()[0].answer())


def verify_browser_zip(path):
    """Actual UI download, not a separately constructed export fixture."""
    import csv
    import io
    with tempfile.TemporaryDirectory() as temp, zipfile.ZipFile(path) as archive:
        assert archive.testzip() is None
        data = json.loads(archive.read('workspace.json'))
        sources = {n['guid']: n for n in data['notes']}
        collection = Collection(str(Path(temp) / 'collection.anki2'))
        try:
            collection.import_anki_package(ImportAnkiPackageRequest(package_path=str(package.OUTPUT)))
            for name in archive.namelist():
                if name.startswith('media/'):
                    collection.media.write_data(name[6:], archive.read(name))
            guids = set()
            for spec in package.specifications():
                filename = spec['name'] + '.tsv'
                if filename not in archive.namelist():
                    continue
                text = archive.read(filename).decode('utf-8')
                path = Path(temp) / filename
                path.write_text(text, encoding='utf-8')
                metadata = collection.get_csv_metadata(str(path), None)
                assert metadata.global_notetype.id == spec['id']
                collection.import_csv(ImportCsvRequest(path=str(path), metadata=metadata))
                while text.startswith('#'):
                    text = text.split('\n', 1)[1]
                for row in csv.reader(io.StringIO(text), delimiter='\t'):
                    guid = row[-1]
                    assert guid not in guids
                    guids.add(guid)
                    note = collection.get_note(collection.db.scalar('select id from notes where guid=?', guid))
                    assert note.fields == [sources[guid]['fields'][f] for f in spec['fields']]
                    assert set(note.tags) == set(sources[guid]['tags'])
                    assert all(c.did == collection.decks.id_for_name(data['deck']) for c in note.cards())
            assert collection.note_count() == len(package.samples()) + len(guids)
            assert not collection.get_empty_cards().notes
            print(f'UI ZIP imported natively: {len(guids)} notes, exact fields/tags/GUIDs, no empty cards')
        finally:
            collection.close()


if __name__ == '__main__':
    verify_browser_zip(sys.argv[1])
