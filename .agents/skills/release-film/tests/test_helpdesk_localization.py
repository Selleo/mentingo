"""Shared camera evidence, localized narration and portable private-state regressions."""
import copy
import json
import os
from pathlib import Path
import shutil
import sys
import tarfile
import tempfile
from types import SimpleNamespace
import unittest
from unittest.mock import patch

sys.dont_write_bytecode = True
SKILL = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(SKILL/'scripts'))
import core
import helpdesk
import helpdesk_catalog
import helpdesk_recording as recording
import helpdesk_store as store
import helpdesk_voices as narrators


class LocalizationTest(unittest.TestCase):
    def setUp(self):
        temporary = tempfile.TemporaryDirectory()
        self.addCleanup(temporary.cleanup)
        self.root = Path(temporary.name).resolve()
        self.cache = self.root/'cache'
        self.commit = 'a'*40
        self.domain = copy.deepcopy(helpdesk_catalog.load_catalog(SKILL/'projects/mentingo-helpdesk.json')['domains'][0])
        self.domain['flows'] = self.domain['flows'][:1]
        self.flow = self.domain['flows'][0]
        self.chapter = {'film':'F1','title':'Create a path','prs':[1],'proofs':['Saved'], 'sentences':[
            {'action':i,'text':text,'line':i} for i,text in enumerate([
                'Open the path editor.','Enter the path title.','Save the development path.'])]}
        self.registry = {'domains':[copy.deepcopy(self.domain)],'sharedWatchPaths':[]}

    def patch(self, owner, name, **kwargs):
        manager = patch.object(owner,name,**kwargs)
        result = manager.start()
        self.addCleanup(manager.stop)
        return result

    def raw(self, flow=None, commit=None):
        flow,commit = flow or self.flow,commit or self.commit
        source = self.root/'raw'/commit/flow['id']
        source.mkdir(parents=True,exist_ok=True)
        (source/'take.mp4').write_bytes(b'visual '+commit.encode())
        (source/'first.jpg').write_bytes(b'review still')
        (source/'download.pdf').write_bytes(b'%PDF-synthetic')
        (source/'worker.log').write_text('must never be archived')
        core.save(source/'capture.json',{'take':str(source/'take.mp4'),'scale':1,'start':0,'end':5,
            'steps':[{'step':i} for i in range(3)],'actions_text':['0 Open','1 Enter','2 Saved'],
            'documents':[{'file':str(source/'download.pdf'),'name':'Result.pdf','step':2,'text':'Saved'}]})
        core.save(source/'actions.json',[{'id':i,'kind':'click','still':'first.jpg','headers':{'private':'never copy'}} for i in range(3)])
        core.save(source/'page-log.json',{'pages':[{'still':'first.jpg'}],'ignored':'never copy'})
        checkout = self.root/'checkout'
        for name in flow['specPaths']:
            document = checkout/name
            document.parent.mkdir(parents=True,exist_ok=True)
            document.write_text('Create and save a path.')
        return recording.cache_capture(self.cache,self.root/'run',source,{'chapters':[self.chapter]},flow,
                                       self.domain,commit,'Selleo/mentingo',checkout)

    def setup_generator(self):
        self.patch(helpdesk_catalog,'load_catalog',return_value=self.registry)
        self.patch(helpdesk.core,'addon',return_value={'harness':{}})
        self.patch(helpdesk.voice_provider,'elevenlabs_config',return_value={'voice':'same-voice','model_id':'test'})
        self.setup = self.patch(helpdesk.harness,'setup')
        self.patch(helpdesk.harness,'keep_set')
        self.patch(helpdesk.harness,'test_env',return_value={})
        self.patch(helpdesk.harness,'checkout',return_value=self.root/'checkout')
        self.patch(helpdesk.doctor,'check',return_value={'ok':True})
        self.patch(helpdesk.core,'sh',side_effect=lambda *a,**kw:SimpleNamespace(stdout=self.commit))
        self.patch(helpdesk.film,'stop')
        self.camera = self.patch(recording,'capture_flow',side_effect=lambda run,flow,domain,commit,*a:self.raw(flow,commit))
        def render(run,flow,domain,code,commit,repo,addon,cache,reference):
            folder = Path(cache)/'segments'/code/flow['id']/reference['id']
            folder.mkdir(parents=True,exist_ok=True)
            video = folder/'demo.mp4'
            video.write_bytes((code+reference['id']).encode())
            return {'path':str(video.relative_to(cache)),'sha256':recording.digest(video),
                'title':'Utwórz ścieżkę' if code=='pl' else 'Create a path','captureId':reference['id'],'language':code}
        self.render = self.patch(recording,'render_flow',side_effect=render)
        def localize(domain,code,previous=None):
            result=copy.deepcopy(domain)
            if code=='pl':
                result.update(title='Ścieżki rozwoju',description='Twórz i przypisuj ścieżki.')
            return result,{'language':code,'title':result['title'],'description':result['description']}
        self.patch(recording,'localize_domain',side_effect=localize)
        def assemble(domain,code,flows,cache,out,*args):
            video=Path(out)/'video.mp4'
            video.parent.mkdir(parents=True,exist_ok=True)
            video.write_bytes(code.encode())
            return {'key':domain['key'],'language':code,'video':str(video),'metadata':{'title':domain['title']}}
        self.assemble = self.patch(recording,'assemble',side_effect=assemble)

    def generate(self,codes=('en','pl'),action='record',name='batch'):
        domain=copy.deepcopy(self.domain)
        domain['coverage']={'decision':'complete'}
        domain['flows']=[dict(f,action=action,reason='Verified',evidence=[]) for f in domain['flows']]
        reports=[{'ok':True,'domains':[domain],'commit':self.commit,'version':'1.2.0','language':code} for code in codes]
        plan=self.root/(name+'-plan.json')
        core.save(plan,{'schemaVersion':1,'reports':reports})
        args=SimpleNamespace(plan=str(plan),run=str(self.root/'run'),cache=str(self.cache),out=str(self.cache/'bundles'/name),
            repository='Selleo/mentingo',repo=str(self.root),workflow_run_id='123')
        return helpdesk.generate(args)

    def published(self):
        state=core.load(self.cache/'state.json')
        state.pop('pendingBundle',None)
        state.pop('pendingSelection',None)
        for language in state['languages'].values():
            for domain in language['domains'].values():
                domain['needsPublication']=False
        core.save(self.cache/'state.json',state)

    def test_one_camera_capture_supports_two_localized_videos(self):
        self.setup_generator()
        result=self.generate()
        self.assertEqual(result['videos'],2)
        self.camera.assert_called_once()
        self.setup.assert_called_once()
        self.assertEqual(self.render.call_count,2)
        references=[call.args[-1]['id'] for call in self.render.call_args_list]
        self.assertEqual(references[0],references[1])
        self.assertEqual([call.args[3] for call in self.render.call_args_list],['en','pl'])
        self.assertEqual([d['metadata']['title'] for d in core.load(result['manifest'])['domains']],
                         ['Development Paths','Ścieżki rozwoju'])

    def test_adding_polish_later_never_starts_browser(self):
        self.setup_generator()
        self.generate(codes=('en',))
        self.published()
        self.camera.reset_mock(); self.setup.reset_mock(); self.render.reset_mock()
        self.assertEqual(self.generate(codes=('pl',),action='reuse',name='polish')['videos'],1)
        self.camera.assert_not_called(); self.setup.assert_not_called(); self.render.assert_called_once()

    def test_semantic_change_records_once_but_internal_refactor_records_nothing(self):
        self.setup_generator()
        self.generate(); self.published()
        self.camera.reset_mock(); self.render.reset_mock(); self.assemble.reset_mock()
        self.commit='b'*40
        self.assertEqual(self.generate(action='reuse',name='refactor')['videos'],0)
        self.camera.assert_not_called(); self.render.assert_not_called(); self.assemble.assert_not_called()
        self.commit='c'*40
        self.assertEqual(self.generate(name='changed')['videos'],2)
        self.camera.assert_called_once()
        self.assertEqual(self.render.call_count,2)

    def test_missing_legacy_raw_capture_requires_explicit_migration(self):
        self.setup_generator()
        self.generate(codes=('en',)); self.published()
        state=core.load(self.cache/'state.json'); state.pop('captures')
        core.save(self.cache/'state.json',state)
        self.camera.reset_mock()
        with self.assertRaisesRegex(ValueError,'explicitly force'):
            self.generate(codes=('pl',),action='reuse',name='legacy')
        self.camera.assert_not_called()

    def test_analyze_calls_semantic_planner_once_for_both_languages(self):
        self.setup_generator()
        self.generate(codes=('en',)); self.published()
        domain=dict(copy.deepcopy(self.domain),flows=[dict(self.flow,action='reuse')])
        planned={'ok':True,'domains':[domain],'commit':self.commit,'version':'1.2.0'}
        analyze=self.patch(helpdesk_catalog,'plan',return_value=planned)
        args=SimpleNamespace(cache=str(self.cache),catalog='ignored',repo=str(self.root),target='v1.2.0',
            domains='',languages='en,pl',force=False,out=str(self.root/'analysis.json'))
        self.assertEqual(helpdesk.analyze(args)['record'],0)
        analyze.assert_called_once()
        self.assertIn(self.flow['id'],analyze.call_args.args[2]['domains'][self.domain['key']]['flows'])
        self.assertEqual([r['language'] for r in core.load(args.out)['reports']],['en','pl'])

    def test_raw_snapshot_survives_new_machine_paths_and_checks_all_dependencies(self):
        reference=self.raw()
        core.save(self.cache/'state.json',{'schemaVersion':1,'languages':{},'captures':{'domains':{
            self.domain['key']:{'flows':{self.flow['id']:{'capture':reference}}}}}})
        files=store.snapshot_files(self.cache)
        self.assertFalse(any(p.name in ('worker.log','secrets.json') for p in files))
        self.assertTrue(any(p.suffix=='.pdf' for p in files)); self.assertTrue(any(p.suffix=='.md' for p in files))
        archive=self.root/'raw.tar'
        with tarfile.open(archive,'w') as target:
            for path in files: target.add(path,arcname=str(path.relative_to(self.cache)),recursive=False)
        restored=self.root/'restored'; store.extract(archive,restored)
        shutil.rmtree(self.root/'raw')
        manifest,chapter=recording.restore_capture(restored,reference,self.root/'view')
        capture=core.load(self.root/'view/capture.json')
        self.assertEqual(Path(capture['take']).read_bytes(),b'visual '+self.commit.encode())
        self.assertTrue(Path(capture['documents'][0]['file']).is_file())
        self.assertTrue((self.root/'view/stills/0.jpg').is_file())
        self.assertEqual(chapter['sentences'],self.chapter['sentences'])
        self.assertNotIn(str(self.root/'raw'),json.dumps(manifest))
        (restored/Path(reference['path']).parent/'take.mp4').write_bytes(b'damaged')
        with self.assertRaisesRegex(ValueError,'damaged'): store.snapshot_files(restored)

    def test_translation_keeps_verified_pins_proofs_and_complete_sentence_order(self):
        texts=['Otwórz edytor ścieżki.','Wpisz tytuł ścieżki.','Zapisz ścieżkę rozwoju.']
        answer={'title':'Utwórz ścieżkę','description':'Utwórz i zapisz ścieżkę.','sentences':[
            {'action':i,'text':text,'label':text} for i,text in enumerate(texts)]}
        model=self.patch(recording.llm,'complete',return_value=(json.dumps(answer),{'provider':'cli'}))
        localized,description=recording.localize_story(self.chapter,'pl','Create and save a path.')
        self.assertEqual(localized['proofs'],['Saved'])
        self.assertEqual([s['action'] for s in localized['sentences']],[0,1,2])
        self.assertEqual([s['label'] for s in localized['sentences']],texts)
        self.assertEqual(self.chapter['sentences'][0]['text'],'Open the path editor.')
        answer['sentences'][0]['action']=2; model.return_value=(json.dumps(answer),{'provider':'cli'})
        with self.assertRaisesRegex(ValueError,'action pin'): recording.localize_story(self.chapter,'pl','Create a path.')

    def test_different_voice_ids_are_rejected_before_camera(self):
        self.setup_generator()
        self.patch(helpdesk.voice_provider,'elevenlabs_config',side_effect=lambda addon,code:{'voice':code})
        before={name:os.environ.get(name) for name in ('RELEASE_FILM_RUN','RELEASE_FILM_VOICE')}
        with self.assertRaisesRegex(ValueError,'same ElevenLabs voice'): self.generate()
        self.assertEqual({name:os.environ.get(name) for name in before},before)
        self.camera.assert_not_called(); self.render.assert_not_called()

    def test_model_profile_change_rerenders_languages_without_camera(self):
        self.setup_generator()
        self.generate(); self.published()
        self.camera.reset_mock(); self.setup.reset_mock(); self.render.reset_mock()
        self.patch(helpdesk.voice_provider,'elevenlabs_config',return_value={'voice':'same-voice','model_id':'new-model'})
        self.assertEqual(self.generate(action='reuse',name='new-model')['videos'],2)
        self.camera.assert_not_called(); self.setup.assert_not_called()
        self.assertEqual(self.render.call_count,2)

    def setup_voice_pool(self):
        provider = helpdesk.voice_provider.elevenlabs_config
        self.setup_generator()
        self.patch(helpdesk.voice_provider, 'elevenlabs_config', side_effect=provider)
        environment = patch.dict(os.environ, dict(zip(narrators.VOICE_VARIABLES,
            ('female-one', 'female-two', 'male-one', 'male-two'))))
        environment.start(); self.addCleanup(environment.stop)
        return self.patch(narrators.secrets, 'choice', return_value='female-two')

    def test_random_narrator_is_shared_by_chapters_languages_and_future_versions(self):
        self.domain['flows'].append(dict(copy.deepcopy(self.flow), id='second-flow'))
        self.registry['domains'] = [copy.deepcopy(self.domain)]
        choose = self.setup_voice_pool()
        rendered_voices = []
        render = self.render.side_effect
        def observe(*args):
            rendered_voices.append(os.environ['ELEVENLABS_VOICE_ID'])
            return render(*args)
        self.render.side_effect = observe
        before = os.environ.get('ELEVENLABS_VOICE_ID')
        self.generate(); self.published()
        self.assertEqual(rendered_voices, ['female-two'] * 4)
        choose.assert_called_once_with(('female-one', 'female-two', 'male-one', 'male-two'))
        state = core.load(self.cache/'state.json')
        self.assertEqual(state['captures']['domains'][self.domain['key']]['voiceId'], 'female-two')
        self.assertEqual(os.environ.get('ELEVENLABS_VOICE_ID'), before)
        self.camera.reset_mock(); self.render.reset_mock()
        self.commit = 'b' * 40
        self.assertEqual(self.generate(action='reuse', name='refactor')['videos'], 0)
        self.camera.assert_not_called(); self.render.assert_not_called(); choose.assert_called_once()
        self.commit = 'c' * 40
        self.generate(name='updated')
        self.assertEqual(rendered_voices, ['female-two'] * 8)
        choose.assert_called_once()

    def test_later_language_keeps_saved_random_voice(self):
        choose = self.setup_voice_pool()
        self.generate(codes=('en',)); self.published()
        self.camera.reset_mock(); self.render.reset_mock()
        self.generate(codes=('pl',), action='reuse', name='polish')
        choose.assert_called_once(); self.camera.assert_not_called(); self.render.assert_called_once()
        state = core.load(self.cache/'state.json')
        english = state['languages']['en']['domains'][self.domain['key']]['flows'][self.flow['id']]
        polish = state['languages']['pl']['domains'][self.domain['key']]['flows'][self.flow['id']]
        self.assertEqual(english['voiceProfile'], polish['voiceProfile'])

    def test_failed_render_retains_narrator_and_restores_environment_on_retry(self):
        choose = self.setup_voice_pool()
        before = os.environ.get('ELEVENLABS_VOICE_ID')
        render = self.render.side_effect
        self.render.side_effect = RuntimeError('Synthetic render failure')
        with self.assertRaisesRegex(RuntimeError, 'Synthetic render failure'): self.generate()
        self.assertEqual(os.environ.get('ELEVENLABS_VOICE_ID'), before)
        self.render.side_effect = render
        self.camera.reset_mock()
        self.generate()
        choose.assert_called_once(); self.camera.assert_not_called()

    def test_removed_narrator_revoices_all_languages_without_new_camera_capture(self):
        choose = self.setup_voice_pool()
        self.generate(); self.published()
        self.camera.reset_mock(); self.render.reset_mock()
        os.environ['ELEVENLABS_VOICE_ID_FEMALE_2'] = 'new-female-two'
        choose.return_value = 'male-one'
        self.generate(action='reuse', name='new-narrator')
        self.camera.assert_not_called(); self.assertEqual(self.render.call_count, 2)
        self.assertEqual(choose.call_count, 2)
        state = core.load(self.cache/'state.json')
        self.assertEqual(state['captures']['domains'][self.domain['key']]['voiceId'], 'male-one')

    def test_partial_or_duplicate_pool_fails_before_camera_or_narration(self):
        self.setup_voice_pool()
        os.environ['ELEVENLABS_VOICE_ID_MALE_2'] = ''
        with self.assertRaisesRegex(ValueError, 'all four narrator'): self.generate()
        os.environ['ELEVENLABS_VOICE_ID_MALE_2'] = 'male-one'
        with self.assertRaisesRegex(ValueError, 'four distinct'): self.generate()
        self.camera.assert_not_called(); self.render.assert_not_called()

    def test_localized_render_uses_own_labels_captions_and_measured_duration(self):
        reference=self.raw()
        texts=['Otwórz edytor ścieżki.','Wpisz tytuł ścieżki.','Zapisz ścieżkę rozwoju.']
        def translate(prompt,system,**kwargs):
            payload=json.loads(prompt)
            polish=payload['language']=='Polish'
            sentences=[{'action':s['action'],'text':texts[i] if polish else s['text'],
                        'label':texts[i] if polish else s['text']} for i,s in enumerate(payload['sentences'])]
            return json.dumps({'title':'Utwórz ścieżkę' if polish else payload['title'],
                'description':'Utwórz i zapisz ścieżkę.' if polish else payload['description'],
                'sentences':sentences}),{'provider':'cli'}
        self.patch(recording.llm,'complete',side_effect=translate)
        self.patch(recording.editor,'chapter_problems',return_value=[])
        verified=self.patch(recording,'verify_story',side_effect=lambda run,flow,data,story:core.save(Path(run)/'sources.json',data))
        def narrate(run,story,addon,root=None):
            folder=Path(root)/'c1'; folder.mkdir(parents=True,exist_ok=True)
            text=' '.join(s['text'] for s in story['chapters'][0]['sentences'])
            (folder/'audio.mp3').write_bytes(text.encode())
            (folder/'subtitles.srt').write_text('1\n00:00:00,100 --> 00:00:01,000\n'+text+'\n\n')
        narration=self.patch(recording.cut,'narrate',side_effect=narrate)
        entries=[]
        def chapter_cut(ffmpeg,chapter,folder,voice,sources,**kwargs):
            entry={'title':chapter['title'],'steps':[[i,s['label']] for i,s in enumerate(chapter['sentences'])]}
            entries.append((sources['language'],copy.deepcopy(entry)))
            return entry,{}
        self.patch(recording.cut,'chapter_cut',side_effect=chapter_cut)
        self.patch(recording.cut,'film_font',return_value=('unused-font','Test',None))
        self.patch(recording.render_demo,'prepare')
        run=self.root/'render-run'
        self.patch(recording.render_demo,'load_plan',side_effect=lambda *args,**kwargs:{'language':core.load(run/'sources.json')['language']})
        def render(plan,out):
            out=Path(out); out.mkdir(parents=True,exist_ok=True)
            code=plan['language']; text=' '.join(texts) if code=='pl' else ' '.join(s['text'] for s in self.chapter['sentences'])
            (out/'demo.mp4').write_bytes(code.encode())
            for ext in ('srt','vtt'): (out/f'captions-{code}.{ext}').write_text(text)
            (out/'poster.jpg').write_bytes(b'image'); core.save(out/'timeline.json',{'duration':8 if code=='pl' else 6})
        self.patch(recording.render_demo,'render',side_effect=render)
        self.patch(recording.render_demo,'probe',side_effect=lambda path:{'format':{'duration':8 if Path(path).read_bytes()==b'pl' else 6}})
        english=recording.render_flow(run,self.flow,self.domain,'en',self.commit,'Selleo/mentingo',{},self.cache,reference)
        polish=recording.render_flow(run,self.flow,self.domain,'pl',self.commit,'Selleo/mentingo',{},self.cache,reference)
        self.assertEqual((english['duration'],polish['duration']),(6,8))
        self.assertEqual(polish['captureId'],english['captureId'])
        self.assertEqual(verified.call_count,2); self.assertEqual(narration.call_count,2)
        self.assertEqual(entries[1][1]['steps'][0][1],texts[0])
        self.assertIn(texts[0],(self.cache/polish['captions']).read_text())
        self.assertNotIn(texts[0],(self.cache/english['captions']).read_text())


if __name__=='__main__': unittest.main()
