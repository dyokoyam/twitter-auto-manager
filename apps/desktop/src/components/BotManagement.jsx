import React, { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { FaPlus, FaReply, FaTrash, FaPlay, FaPause, FaCog, FaTwitter, FaKey, FaRobot, FaPaperPlane, FaClock, FaFileAlt, FaTimes, FaArrowUp, FaArrowDown, FaList } from 'react-icons/fa';
import './BotManagement.css';

function BotManagement({ onUpdate, userSettings }) {
  
  const [botAccounts, setBotAccounts] = useState([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isConfigModalOpen, setIsConfigModalOpen] = useState(false);
  const [isTweetModalOpen, setIsTweetModalOpen] = useState(false);
  const [isReplyModalOpen, setIsReplyModalOpen] = useState(false);
  const [currentBot, setCurrentBot] = useState({
    account_name: '',
    api_type: 'Free',
    api_key: '',
    api_key_secret: '',
    access_token: '',
    access_token_secret: '',
    status: 'inactive'
  });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [testingBotId, setTestingBotId] = useState(null);
  const [selectedBotForTweet, setSelectedBotForTweet] = useState(null);
  const [tweetContent, setTweetContent] = useState('');
  
  // 返信機能：新仕様
  const [selectedBotForReply, setSelectedBotForReply] = useState(null); // 返信するBot（「返信」ボタンを押したBot自身）
  const [selectedTargetBots, setSelectedTargetBots] = useState([]); // 監視対象Bot（複数選択可）
  const [replyContent, setReplyContent] = useState('');
  const [replySettings, setReplySettings] = useState([]);
  
  const [selectedBotForConfig, setSelectedBotForConfig] = useState(null);
  const [scheduledTimes, setScheduledTimes] = useState([]);
  
  // 投稿内容リスト管理
  const [postContentList, setPostContentList] = useState(['']);
  const [currentPostIndex, setCurrentPostIndex] = useState(0);
  const [newPostContent, setNewPostContent] = useState('');

  // 時間選択肢を生成（0:00〜23:00）
  const timeOptions = Array.from({ length: 24 }, (_, i) => {
    const hour = i.toString().padStart(2, '0');
    return `${hour}:00`;
  });

  useEffect(() => {
    fetchBotAccounts({ showLoader: true });
    fetchReplySettings();
  }, []);

  const fetchBotAccounts = async (options = {}) => {
    const showLoader = options?.showLoader ?? false;

    if (showLoader) {
      setIsLoading(true);
    }
    setError(null);
    
    try {
      const accounts = await invoke('get_bot_accounts');
      setBotAccounts(accounts || []);
    } catch (error) {
      console.error('API call failed:', error);
      setError(`APIエラー: ${error.toString()}`);
    } finally {
      if (showLoader) {
        setIsLoading(false);
      } else {
        setIsLoading((prev) => (prev ? false : prev));
      }
    }
  };

  const fetchReplySettings = async () => {
    try {
      const settings = await invoke('get_reply_settings');
      setReplySettings(settings || []);
    } catch (error) {
      console.error('Failed to fetch reply settings:', error);
    }
  };

  const openAddModal = () => {
    setCurrentBot({
      account_name: '',
      api_type: 'Free',
      api_key: '',
      api_key_secret: '',
      access_token: '',
      access_token_secret: '',
      status: 'inactive'
    });
    setIsModalOpen(true);
  };

  // 新仕様：「返信」ボタンを押したBotが返信者として設定される
  const handleReply = (bot) => {
    setSelectedBotForReply(bot); // 返信するBot（このBotが自動返信する）
    setSelectedTargetBots([]); // 監視対象Botをリセット
    setReplyContent('');
    setIsReplyModalOpen(true);
  };

  const openConfigModal = async (bot) => {
    setSelectedBotForConfig(bot);
    
    try {
      // Bot設定を取得    await invoke('get_bot_config', { accountId: bot.id });
    // スケジュール投稿データを取得
      try {
        const scheduledTweets = await invoke('get_scheduled_tweets', { accountId: bot.id });
        
        if (scheduledTweets && scheduledTweets.length > 0) {
          // 最新のスケジュール投稿データを使用
          const latestSchedule = scheduledTweets[0];
          const times = latestSchedule.scheduled_times ? latestSchedule.scheduled_times.split(',') : [];
          setScheduledTimes(times);
          
          // 投稿内容リストの処理
          if (latestSchedule.content_list) {
            try {
              const contentList = JSON.parse(latestSchedule.content_list);
              if (Array.isArray(contentList) && contentList.length > 0) {
                setPostContentList(contentList);
                setCurrentPostIndex(latestSchedule.current_index || 0);
              } else {
                // 従来形式のフォールバック
                setPostContentList([latestSchedule.content || '']);
                setCurrentPostIndex(0);
              }
            } catch (parseError) {
              console.warn('Failed to parse content_list, using fallback:', parseError);
              setPostContentList([latestSchedule.content || '']);
              setCurrentPostIndex(0);
            }
          } else if (latestSchedule.content) {
            // 従来形式
            setPostContentList([latestSchedule.content]);
            setCurrentPostIndex(0);
          } else {
            // 初期値
            setPostContentList(['']);
            setCurrentPostIndex(0);
          }
        } else {
          // データがない場合は初期値
          setScheduledTimes([]);
          setPostContentList(['']);
          setCurrentPostIndex(0);
        }
      } catch (scheduleError) {
        console.warn('No scheduled tweets found or error loading:', scheduleError);
        // スケジュール投稿データがない場合は初期値
        setScheduledTimes([]);
        setPostContentList(['']);
        setCurrentPostIndex(0);
      }
      
      setIsConfigModalOpen(true);
    } catch (error) {
      console.error('Failed to fetch bot config:', error);
      alert('Bot設定の取得に失敗しました。');
    }
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setIsConfigModalOpen(false);
    setIsTweetModalOpen(false);
    setIsReplyModalOpen(false);
    setTweetContent('');
    setReplyContent('');
    setSelectedBotForTweet(null);
    setSelectedBotForReply(null);
    setSelectedTargetBots([]);
    setSelectedBotForConfig(null);
    setScheduledTimes([]);
    setPostContentList(['']);
    setCurrentPostIndex(0);
    setNewPostContent('');
  };

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    setCurrentBot({
      ...currentBot,
      [name]: type === 'checkbox' ? checked : value
    });
  };
  const handleTimeChange = (time, checked) => {
    if (checked) {
      setScheduledTimes([...scheduledTimes, time]);
    } else {
      setScheduledTimes(scheduledTimes.filter(t => t !== time));
    }
  };

  // 投稿内容リスト管理
  const addPostContent = () => {
    if (newPostContent.trim()) {
      setPostContentList([...postContentList, newPostContent.trim()]);
      setNewPostContent('');
    }
  };

  const updatePostContent = (index, content) => {
    const newList = [...postContentList];
    newList[index] = content;
    setPostContentList(newList);
  };

  const removePostContent = (index) => {
    if (postContentList.length > 1) {
      const newList = postContentList.filter((_, i) => i !== index);
      setPostContentList(newList);
      // インデックス調整
      if (currentPostIndex >= newList.length) {
        setCurrentPostIndex(Math.max(0, newList.length - 1));
      }
    }
  };

  const movePostContent = (index, direction) => {
    const newList = [...postContentList];
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    
    if (targetIndex >= 0 && targetIndex < newList.length) {
      [newList[index], newList[targetIndex]] = [newList[targetIndex], newList[index]];
      setPostContentList(newList);
      
      // 現在のインデックスも調整
      if (currentPostIndex === index) {
        setCurrentPostIndex(targetIndex);
      } else if (currentPostIndex === targetIndex) {
        setCurrentPostIndex(index);
      }
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // バリデーション
    if (!currentBot.account_name.trim()) {
      alert('アカウント名を入力してください。');
      return;
    }
    if (!currentBot.api_key.trim()) {
      alert('API Keyを入力してください。');
      return;
    }
    if (!currentBot.api_key_secret.trim()) {
      alert('API Key Secretを入力してください。');
      return;
    }
    if (!currentBot.access_token.trim()) {
      alert('Access Tokenを入力してください。');
      return;
    }
    if (!currentBot.access_token_secret.trim()) {
      alert('Access Token Secretを入力してください。');
      return;
    }
    
    try {
      await invoke('add_bot_account', { account: currentBot });
      alert('Botアカウントを追加しました！');
      
      fetchBotAccounts();
      if (onUpdate) onUpdate();
      closeModal();
    } catch (error) {
      console.error('Failed to save bot account:', error);
      alert(`Bot アカウントの保存に失敗しました。\n\nエラー詳細: ${error}`);
    }
  };

  const handleConfigSubmit = async (e) => {
    e.preventDefault();
    
    // バリデーション
    if (scheduledTimes.length === 0) {
      alert('投稿予定時間を少なくとも1つ選択してください。');
      return;
    }
    
    // 空でない投稿内容のみをフィルタリング
    const validContentList = postContentList.filter(content => content.trim() !== '');
    if (validContentList.length === 0) {
      alert('投稿内容を少なくとも1つ入力してください。');
      return;
    }
    
    try {
      // 投稿内容リストとして保存
      await invoke('save_scheduled_tweet_list', {
        accountId: selectedBotForConfig.id,
        scheduledTimes: scheduledTimes.join(','),
        contentList: validContentList
      });
      
      alert(`Bot設定を保存しました！\n\n投稿内容: ${validContentList.length}件\n投稿時間: ${scheduledTimes.length}件\n\n選択した時間に順番に自動投稿されます。`);
      fetchBotAccounts();
      if (onUpdate) onUpdate();
      closeModal();
    } catch (error) {
      console.error('Failed to save bot config:', error);
      alert(`Bot 設定の保存に失敗しました。\n\nエラー詳細: ${error}`);
    }
  };

  const handleDeleteBot = async (id) => {
    if (window.confirm('このBotを削除してもよろしいですか？関連する設定とログも削除されます。')) {
      try {
        await invoke('delete_bot_account', { id });
        fetchBotAccounts();
        if (onUpdate) onUpdate();
      } catch (error) {
        console.error('Failed to delete bot account:', error);
        alert('Botの削除に失敗しました。');
      }
    }
  };

  const toggleBotStatus = async (bot) => {
    const newStatus = bot.status === 'active' ? 'inactive' : 'active';
    
    try {
      await invoke('update_bot_account', {
        account: { ...bot, status: newStatus }
      });
      fetchBotAccounts();
      if (onUpdate) onUpdate();
    } catch (error) {
      console.error('Failed to toggle bot status:', error);
      alert('Bot状態の変更に失敗しました。');
    }
  };

  const handleTestTweet = async (botId, botName) => {
    setSelectedBotForTweet({ id: botId, name: botName });
    setTweetContent('');
    setIsTweetModalOpen(true);
  };

  const handleTweetSubmit = async (e) => {
    e.preventDefault();
    
    if (!tweetContent.trim()) {
      alert('投稿内容を入力してください。');
      return;
    }
    
    if (tweetContent.length > 280) {
      alert('投稿内容が280文字を超えています。');
      return;
    }
    
    setTestingBotId(selectedBotForTweet.id);
    
    try {
      const result = await invoke('test_tweet', {
        request: {
          account_id: selectedBotForTweet.id,
          content: tweetContent
        }
      });
      
      
      if (result.success) {
        alert(`✅ 投稿が成功しました！\n\nツイートID: ${result.tweet_id}\n\n「Bot実行ログ」ページで詳細を確認できます。`);
        if (onUpdate) onUpdate(); // 統計情報を更新
        closeModal();
      } else {
        alert(`❌ 投稿に失敗しました。\n\nエラー: ${result.message}\n\n「Bot実行ログ」ページでエラー詳細を確認してください。`);
      }
    } catch (error) {
      console.error('Failed to send tweet:', error);
      alert(`❌ 投稿中にエラーが発生しました。\n\nエラー詳細: ${error}\n\nAPI Keyの設定を確認してください。`);
    } finally {
      setTestingBotId(null);
    }
  };

  // 新仕様：返信設定保存
  const handleReplySubmit = async (e) => {
    e.preventDefault();
    
    if (!selectedBotForReply) {
      alert('返信するBotが選択されていません。');
      return;
    }
    
    if (selectedTargetBots.length === 0) {
      alert('監視対象アカウントを少なくとも1つ選択してください。');
      return;
    }
    
    if (!replyContent.trim()) {
      alert('返信内容を入力してください。');
      return;
    }
    
    if (replyContent.length > 280) {
      alert('返信内容が280文字を超えています。');
      return;
    }
    
    try {
      
      await invoke('save_reply_settings', {
        replyBotId: selectedBotForReply.id,          // 返信するBot（単一）
        targetBotIds: selectedTargetBots.map(bot => bot.id), // 監視対象Bot（複数）
        replyContent: replyContent
      });
      
      alert(`✅ 返信設定を保存しました！\n\n返信Bot: ${selectedBotForReply.account_name}\n監視対象: ${selectedTargetBots.map(bot => bot.account_name).join(', ')}\n\n選択した監視対象が投稿するたびに、${selectedBotForReply.account_name}が自動返信します。`);
      
      fetchReplySettings();
      if (onUpdate) onUpdate();
      closeModal();
    } catch (error) {
      console.error('Failed to save reply settings:', error);
      alert(`❌ 返信設定の保存に失敗しました。\n\nエラー詳細: ${error}`);
    }
  };

  const handleDeleteReplySettings = async (id) => {
    if (window.confirm('この返信設定を削除してもよろしいですか？')) {
      try {
        await invoke('delete_reply_settings', { id });
        fetchReplySettings();
        if (onUpdate) onUpdate();
      } catch (error) {
        console.error('Failed to delete reply settings:', error);
        alert('返信設定の削除に失敗しました。');
      }
    }
  };

  // 新仕様：監視対象Bot（複数選択）の切り替え
  const handleTargetBotToggle = (bot, checked) => {
    if (checked) {
      setSelectedTargetBots([...selectedTargetBots, bot]);
    } else {
      setSelectedTargetBots(selectedTargetBots.filter(b => b.id !== bot.id));
    }
  };

  const getBotName = (botId) => {
    const bot = botAccounts.find(b => b.id === botId);
    return bot ? bot.account_name : `Bot ${botId}`;
  };

  // 新仕様：複数の監視対象IDから名前を取得
  const getTargetBotNames = (targetBotIds) => {
    try {
      const ids = JSON.parse(targetBotIds);
      return ids.map(id => getBotName(id)).join(', ');
    } catch (error) {
      return 'N/A';
    }
  };

  const getApiTypeBadge = (apiType) => {
    const badges = {
      'Free': { text: '新API(無料)', class: 'api-free' },
      'Basic': { text: 'Basic', class: 'api-basic' },
      'Pro': { text: 'Pro', class: 'api-pro' }
    };
    
    return badges[apiType] || badges['Free'];
  };


  if (error) {
    return (
      <div className="page-container">
        <div className="page-header">
          <h1 className="page-title">Bot管理</h1>
        </div>
        <div className="card">
          <div style={{ 
            textAlign: 'center', 
            padding: '40px',
            color: '#EF4444'
          }}>
            <h3>エラーが発生しました</h3>
            <p>{error}</p>
            <button 
              className="btn btn-primary" 
              onClick={() => fetchBotAccounts({ showLoader: true })}
              style={{ marginTop: '16px' }}
            >
              再試行
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="page-container">
        <div className="loading">
          <div className="spinner"></div>
          読み込み中...
        </div>
      </div>
    );
  }

  return (
    <div className="page-container">
      <div className="page-header">
        <h1 className="page-title">Bot管理</h1>
        <p className="page-subtitle">
          Twitter Bot アカウントの管理と設定を行います
          ({botAccounts.length}/{userSettings?.max_accounts || 1} 使用中)
        </p>
      </div>

      <div className="card">
        <div className="card-header">
          <h2 className="card-title">Bot一覧</h2>
          <button 
            className="btn btn-primary"
            onClick={openAddModal}
          >
            <FaPlus /> 新規追加
          </button>
        </div>

        {botAccounts.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">
              <FaRobot />
            </div>
            <h3 className="empty-state-title">Botがまだ登録されていません</h3>
            <p className="empty-state-description">
              「新規追加」ボタンから最初のBotを追加してください。
            </p>
            <button className="btn btn-primary" onClick={openAddModal}>
              <FaPlus /> 最初のBotを追加
            </button>
          </div>
        ) : (
          <div className="bot-grid">
            {botAccounts.map((bot) => {
              return (
                <div key={bot.id} className="bot-card">
                  <div className="bot-header">
                    <div className="bot-info">
                      <h3 className="bot-name">{bot.account_name || 'Unknown'}</h3>
                      <div className="bot-username">
                        <FaTwitter className="twitter-icon" />
                        {bot.account_name || 'unknown'}
                      </div>
                    </div>
                    <div className="bot-status">
                      <div className={`api-badge ${getApiTypeBadge(bot.api_type).class}`}>
                        {getApiTypeBadge(bot.api_type).text}
                      </div>
                      <div className={`status-badge ${bot.status || 'inactive'}`}>
                        <div className="status-indicator"></div>
                        {(bot.status === 'active') ? '稼働中' : '停止中'}
                      </div>
                    </div>
                  </div>

                  <div className="bot-stats">
                    <div className="stat">
                      <span className="stat-label">API種類:</span>
                      <span className="stat-value">{bot.api_type}</span>
                    </div>
                    <div className="stat">
                      <span className="stat-label">ステータス:</span>
                      <span className="stat-value">
                        {bot.status === 'active' ? '稼働中' : '停止中'}
                      </span>
                    </div>
                  </div>

                  <div className="bot-actions">
                    <button
                      className={`btn ${bot.status === 'active' ? 'btn-secondary' : 'btn-success'}`}
                      onClick={() => toggleBotStatus(bot)}
                      title={bot.status === 'active' ? '停止' : '開始'}
                    >
                      {bot.status === 'active' ? <FaPause /> : <FaPlay />}
                      {bot.status === 'active' ? '停止' : '開始'}
                    </button>
                    
                    <button
                      className="btn btn-primary"
                      onClick={() => handleTestTweet(bot.id, bot.account_name)}
                      disabled={testingBotId === bot.id}
                      title="投稿"
                    >
                      {testingBotId === bot.id ? (
                        <>⏳ 投稿中...</>
                      ) : (
                        <>
                          <FaPaperPlane />
                          投稿
                        </>
                      )}
                    </button>
                    
                    <button
                      className="btn btn-secondary"
                      onClick={() => openConfigModal(bot)}
                      title="設定"
                    >
                      <FaCog />
                    </button>
                    
                    <button
                      className="btn btn-secondary"
                      onClick={() => handleReply(bot)}
                      title="返信"
                    >
                      <FaReply />
                    </button>
                    
                    <button
                      className="btn btn-danger"
                      onClick={() => handleDeleteBot(bot.id)}
                      title="削除"
                    >
                      <FaTrash />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Bot追加モーダル */}
      {isModalOpen && (
        <div className="modal-overlay">
          <div className="modal">
            <div className="modal-header">
              <h2 className="modal-title">Bot追加</h2>
            </div>
            
            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label className="form-label">アカウント名</label>
                <input
                  type="text"
                  name="account_name"
                  className="form-input"
                  value={currentBot.account_name}
                  onChange={handleInputChange}
                  placeholder="例: my_twitter_bot"
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">API種類</label>
                <select
                  name="api_type"
                  className="form-select"
                  value={currentBot.api_type}
                  onChange={handleInputChange}
                >
                  <option value="Free">新API(無料 | Free)</option>
                  <option value="Basic">Basic</option>
                  <option value="Pro">Pro</option>
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">
                  <FaKey /> API Key
                </label>
                <input
                  type="text"
                  name="api_key"
                  className="form-input"
                  value={currentBot.api_key}
                  onChange={handleInputChange}
                  placeholder="Twitter API Key"
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">
                  <FaKey /> API Key Secret
                </label>
                <input
                  type="password"
                  name="api_key_secret"
                  className="form-input"
                  value={currentBot.api_key_secret}
                  onChange={handleInputChange}
                  placeholder="Twitter API Key Secret"
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">
                  <FaKey /> Access Token
                </label>
                <input
                  type="text"
                  name="access_token"
                  className="form-input"
                  value={currentBot.access_token}
                  onChange={handleInputChange}
                  placeholder="Twitter Access Token"
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">
                  <FaKey /> Access Token Secret
                </label>
                <input
                  type="password"
                  name="access_token_secret"
                  className="form-input"
                  value={currentBot.access_token_secret}
                  onChange={handleInputChange}
                  placeholder="Twitter Access Token Secret"
                  required
                />
              </div>

              <div className="modal-actions">
                <button type="button" className="btn btn-secondary" onClick={closeModal}>
                  キャンセル
                </button>
                <button type="submit" className="btn btn-primary">
                  追加
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Bot設定モーダル（投稿内容リスト対応版） */}
      {isConfigModalOpen && (
        <div className="modal-overlay">
          <div className="modal modal-large">
            <div className="modal-header">
              <h2 className="modal-title">
                Bot設定 - {selectedBotForConfig?.account_name}
              </h2>
            </div>
            
            <form onSubmit={handleConfigSubmit}>
              <div className="form-group">
                <label className="form-label">
                  <FaClock /> 投稿予定時間
                </label>
                <div className="time-checkbox-grid">
                  {timeOptions.map((time) => (
                    <label key={time} className="time-checkbox">
                      <input
                        type="checkbox"
                        checked={scheduledTimes.includes(time)}
                        onChange={(e) => handleTimeChange(time, e.target.checked)}
                      />
                      <span className="time-label">{time}</span>
                    </label>
                  ))}
                </div>
                <div className="selected-times">
                  {scheduledTimes.length > 0 && (
                    <p>
                      選択された時間: {scheduledTimes.sort().join(', ')}
                    </p>
                  )}
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">
                  <FaList /> 投稿内容リスト
                </label>
                <p style={{ fontSize: '13px', color: '#6B7280', marginBottom: '12px' }}>
                  複数の投稿内容を登録すると、順番に自動投稿されます。
                  現在のインデックス: <strong>{currentPostIndex + 1}</strong> / {postContentList.length}
                </p>
                
                {/* 既存の投稿内容リスト */}
                <div className="post-content-list">
                  {postContentList.map((content, index) => (
                    <div key={index} className={`post-content-item ${index === currentPostIndex ? 'current' : ''}`}>
                      <div className="post-content-header">
                        <span className="post-content-number">
                          {index + 1}
                          {index === currentPostIndex && <span className="current-indicator">← 次回投稿</span>}
                        </span>
                        <div className="post-content-actions">
                          <button
                            type="button"
                            className="btn-icon"
                            onClick={() => movePostContent(index, 'up')}
                            disabled={index === 0}
                            title="上に移動"
                          >
                            <FaArrowUp />
                          </button>
                          <button
                            type="button"
                            className="btn-icon"
                            onClick={() => movePostContent(index, 'down')}
                            disabled={index === postContentList.length - 1}
                            title="下に移動"
                          >
                            <FaArrowDown />
                          </button>
                          <button
                            type="button"
                            className="btn-icon btn-danger"
                            onClick={() => removePostContent(index)}
                            disabled={postContentList.length === 1}
                            title="削除"
                          >
                            <FaTimes />
                          </button>
                        </div>
                      </div>
                      <textarea
                        className="form-textarea"
                        value={content}
                        onChange={(e) => updatePostContent(index, e.target.value)}
                        placeholder="投稿内容を入力してください..."
                        rows={3}
                        maxLength={280}
                      />
                      <div style={{ 
                        textAlign: 'right', 
                        fontSize: '12px', 
                        color: content.length > 280 ? '#EF4444' : '#6B7280',
                        marginTop: '4px'
                      }}>
                        {content.length}/280文字
                      </div>
                    </div>
                  ))}
                </div>
                
                {/* 新しい投稿内容追加 */}
                <div className="add-post-content">
                  <div className="form-group" style={{ marginBottom: '8px' }}>
                    <textarea
                      className="form-textarea"
                      value={newPostContent}
                      onChange={(e) => setNewPostContent(e.target.value)}
                      placeholder="新しい投稿内容を追加..."
                      rows={3}
                      maxLength={280}
                    />
                    <div style={{ 
                      textAlign: 'right', 
                      fontSize: '12px', 
                      color: newPostContent.length > 280 ? '#EF4444' : '#6B7280',
                      marginTop: '4px'
                    }}>
                      {newPostContent.length}/280文字
                    </div>
                  </div>
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={addPostContent}
                    disabled={!newPostContent.trim() || newPostContent.length > 280}
                  >
                    <FaPlus /> 投稿内容を追加
                  </button>
                </div>
              </div>

              <div className="modal-actions">
                <button type="button" className="btn btn-secondary" onClick={closeModal}>
                  キャンセル
                </button>
                <button type="submit" className="btn btn-primary">
                  設定を保存
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 投稿モーダル */}
      {isTweetModalOpen && (
        <div className="modal-overlay">
          <div className="modal">
            <div className="modal-header">
              <h2 className="modal-title">
                投稿作成 - {selectedBotForTweet?.name}
              </h2>
            </div>
            
            <form onSubmit={handleTweetSubmit}>
              <div className="form-group">
                <label className="form-label">
                  <FaPaperPlane /> 投稿内容
                </label>
                <textarea
                  className="form-textarea"
                  value={tweetContent}
                  onChange={(e) => setTweetContent(e.target.value)}
                  placeholder="投稿したい内容を入力してください..."
                  rows={4}
                  maxLength={280}
                  required
                />
                <div style={{ 
                  textAlign: 'right', 
                  fontSize: '12px', 
                  color: tweetContent.length > 280 ? '#EF4444' : '#6B7280',
                  marginTop: '4px'
                }}>
                  {tweetContent.length}/280文字
                </div>
              </div>

              <div className="modal-actions">
                <button type="button" className="btn btn-secondary" onClick={closeModal}>
                  キャンセル
                </button>
                <button 
                  type="submit" 
                  className="btn btn-primary"
                  disabled={testingBotId === selectedBotForTweet?.id || tweetContent.length > 280}
                >
                  {testingBotId === selectedBotForTweet?.id ? '投稿中...' : '投稿'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 返信設定モーダル（新仕様版） */}
      {isReplyModalOpen && (
        <div className="modal-overlay">
          <div className="modal modal-large">
            <div className="modal-header">
              <h2 className="modal-title">
                返信設定 - {selectedBotForReply?.account_name}
              </h2>
            </div>
            
            <form onSubmit={handleReplySubmit}>
              <div className="form-group">
                <label className="form-label">
                  <FaRobot /> 返信するBot
                </label>
                <p style={{ fontSize: '13px', color: '#6B7280', marginBottom: '8px' }}>
                  このBotが監視対象の投稿に自動返信します
                </p>
                <div className="reply-bot-display">
                  <FaRobot className="reply-bot-icon" />
                  <span className="reply-bot-name">{selectedBotForReply?.account_name}</span>
                  <span className="reply-bot-note">（このBotが返信します）</span>
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">
                  <FaList /> 監視対象アカウント（複数選択可）
                </label>
                <p style={{ fontSize: '13px', color: '#6B7280', marginBottom: '12px' }}>
                  これらのアカウントが投稿した時に、上記のBotが自動返信します
                </p>
                <div className="bot-selection-grid">
                  {botAccounts.filter(bot => bot.status === 'active' && bot.id !== selectedBotForReply?.id).map((bot) => (
                    <label key={bot.id} className="bot-selection-item">
                      <input
                        type="checkbox"
                        checked={selectedTargetBots.some(tb => tb.id === bot.id)}
                        onChange={(e) => handleTargetBotToggle(bot, e.target.checked)}
                      />
                      <div className="bot-selection-info">
                        <span className="bot-selection-name">{bot.account_name}</span>
                        <span className="bot-selection-type">{bot.api_type}</span>
                      </div>
                    </label>
                  ))}
                </div>
                {selectedTargetBots.length > 0 && (
                  <div className="selected-bots">
                    <p>監視対象: {selectedTargetBots.map(bot => bot.account_name).join(', ')}</p>
                  </div>
                )}
              </div>

              <div className="form-group">
                <label className="form-label">
                  <FaFileAlt /> 返信内容
                </label>
                <textarea
                  className="form-textarea"
                  value={replyContent}
                  onChange={(e) => setReplyContent(e.target.value)}
                  placeholder="自動返信したい内容を入力してください..."
                  rows={4}
                  maxLength={280}
                  required
                />
                <div style={{ 
                  textAlign: 'right', 
                  fontSize: '12px', 
                  color: replyContent.length > 280 ? '#EF4444' : '#6B7280',
                  marginTop: '4px'
                }}>
                  {replyContent.length}/280文字
                </div>
              </div>

              <div className="modal-actions">
                <button type="button" className="btn btn-secondary" onClick={closeModal}>
                  キャンセル
                </button>
                <button 
                  type="submit" 
                  className="btn btn-primary"
                  disabled={!selectedBotForReply || selectedTargetBots.length === 0 || replyContent.length > 280}
                >
                  設定を保存
                </button>
              </div>
            </form>

            {/* 既存の返信設定一覧（新仕様版） */}
            {replySettings.length > 0 && (
              <div style={{ marginTop: '32px', paddingTop: '24px', borderTop: '1px solid var(--border-color)' }}>
                <h3 style={{ marginBottom: '16px', fontSize: '18px', fontWeight: '600' }}>現在の返信設定</h3>
                <div className="reply-settings-list">
                  {replySettings.map((setting) => (
                    <div key={setting.id} className="reply-setting-item">
                      <div className="reply-setting-header">
                        <div className="reply-setting-info">
                          <div className="reply-setting-target">
                            <strong>{getBotName(setting.reply_bot_id)}</strong> が自動返信
                          </div>
                          <div className="reply-setting-bots">
                            監視対象: {getTargetBotNames(setting.target_bot_ids)}
                          </div>
                        </div>
                        <button
                          type="button"
                          className="btn btn-danger btn-sm"
                          onClick={() => handleDeleteReplySettings(setting.id)}
                          title="削除"
                        >
                          <FaTrash />
                        </button>
                      </div>
                      <div className="reply-setting-content">
                        「{setting.reply_content}」
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default BotManagement;