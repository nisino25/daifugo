<template>
  <div id="app">
    <div class="inner">
      <div v-if="currentPage === 'before'">
        <div class="input-modal">
          <h2>プレイヤー名を入力してください</h2>
          <div v-for="(player, index) in players" :key="index" class="player-input">
            <input type="text" v-model="player.name" placeholder="名前を入力">
            <button @click="removePlayer(index)">x</button>
          </div>
          <button v-if="players.length < maxPlayerNumber" @click="addPlayer" class="add-button">+</button>
          <button v-if="readyToPlay" @click="goToGamePage" class="start-button">{{players.length}}人で遊ぶ</button>
        </div>
      </div>

      <div v-if="currentPage === 'game'">
        <div class="screens-cotainer">
          <template v-for="(player, index) in players" :key="index">
            <div class="main-container">
              <div class="area-container">
                <div class="others-area">Chat&nbsp;&nbsp;<i class="fa-regular fa-comment"></i> <span>Settings&nbsp;&nbsp;<i class="fa-solid fa-gear"></i></span></div>
                <div class="other-players-area">
                  <template v-for="otherPlayer in getOtherPlayers(player.name)" :key="otherPlayer.name">                  
                    <PlayerInfo
                      :player="otherPlayer"
                      :isActive="otherPlayer.name === currentPlayer.name"
                      :hand="playerHands(otherPlayer.name)"
                    />
                    
                  </template>
                </div>
                <div class="public-area">
                  <div class="public-cards-container">
                    <template v-for="(group, groupIndex) in groupedPublicPile" :key="groupIndex">
                      <div class="timestamp-group" :style="getCardStyle(group[0])" :class="[{ 'previous-card': !previousCards.includes(group[0]) }]">
                        <template v-for="(card,cardIndex) in group" :key="card.id">
                          <GameCard :card="card" @click="pickCard(player.name, card)" :style="getGap(cardIndex,group)" />
                        </template>
                      </div>
                    </template>
                  </div>
                </div>

                <div class="personal-area">
                  <PlayerInfo
                    :player="player"
                    :isActive="player.name === currentPlayer.name"
                    :hand="playerHands(player.name)"
                  />
                  <div class="personal-cards-container"  v-if="player.name === currentPlayer.name">
                    <template v-for="(card, index) in currentPlayerHands" :key="card.id">
                      <GameCard
                        :card="card"
                        :style="calculateCardPosition(index, currentPlayerHands.length, card)"
                        @click="pickCard(player.name, card)"
                      />
                    </template>
                    <div class="action-buttons-container"  :style="player.name !== currentPlayer.name ? { transform: 'translate(-50%, 150%)' } : {}">
                      <button @click="passToNext()" :class="{ 'disable-button': currentPlayerPickedHands.length > 0 }">パス</button>
                      <button @click="unpickAllCurrentPlayerCards()" :class="{ 'disable-button': currentPlayerPickedHands.length == 0 }">キャンセル</button>
                      <button @click="submit()" :class="{ 'disable-button': !readyToSubmit }">出す</button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </template>
        </div>

      </div>
    </div>
  </div>
</template>

<script>

import { randomNames } from './name.js';
import PlayerInfo from './PlayerInfo.vue';
import GameCard from './GameCard.vue';

export default {
  components: {
    PlayerInfo,
    GameCard,
  },
  data() {
    return {
      developingMode: true,

      defaultNumber: 3,
      maxPlayerNumber: 6,
      randomNames,


      currentPage: 'before',
      players: [],
      currentPlayerIndex: 0,
      

      deck:[],
      lastSubmitBy: null,


    };
  },
  computed: {
    readyToPlay() {
      const namePattern = /^[^\s!@#$%^&*(),.?":{}|<>]+$/;
      const uniqueNames = new Set(this.players.map(player => player.name.trim()));
      
      return this.players.length >= 2 &&
        this.players.length <= this.maxPlayerNumber &&
        uniqueNames.size === this.players.length &&
        this.players.every(player => 
          player.name.trim() !== '' && namePattern.test(player.name)
      );
    },
    currentPlayer() {
      return this.players[this.currentPlayerIndex];
    },
    drawPile() {
      return this.deck.filter(card => card.location === 'drawPile');
    },
    trashPile() {
      return this.deck.filter(card => card.location === 'trash');
    },
    sortedTrashPile() {
      return this.deck
            .filter(card => card.location === 'trash' && card.type === 'food')
            .sort((a, b) => a.name.localeCompare(b.name));
    },
    publicPile() {
      // Filter cards located in 'publicArea'
      const filteredCards = this.deck.filter(card => card.location === 'publicArea');

      // Sort cards by the timestamp in descending order (latest first)
      const sortedByTimestamp = filteredCards.sort((a, b) => b.updatedAt - a.updatedAt);

      // Mark the latest cards as 'isPreviousCard'
      if (sortedByTimestamp.length > 0) {
        const latestTimestamp = sortedByTimestamp[0].updatedAt;
        sortedByTimestamp.forEach(card => card.isPreviousCard = card.updatedAt === latestTimestamp);
      }

      // Further sort the cards by value and suit
      const sortedCards = sortedByTimestamp.sort((a, b) => {
        // First, sort by value
        const valueComparison = a.value - b.value;
        if (valueComparison !== 0) {
          return valueComparison;
        }
        // Then, sort by suit
        const suitOrder = ['Hearts', 'Diamonds', 'Clubs', 'Spades'];
        return suitOrder.indexOf(a.suit) - suitOrder.indexOf(b.suit);
      });

      return sortedCards;
    },
    groupedPublicPile() {
      // Group cards by the timestamp
      const grouped = {};
      this.publicPile.forEach(card => {
        if (!grouped[card.updatedAt]) {
          grouped[card.updatedAt] = [];
        }
        grouped[card.updatedAt].push(card);
      });
      // Return groups as an array with latest timestamp groups first
      return Object.values(grouped).sort((a, b) =>  a[0].updatedAt - b[0].updatedAt);
    },
    previousCards() {
      return this.publicPile.filter(card => card.isPreviousCard);
    },
    playerHands() {
      return playerName => this.deck
        .filter(card => card.location === playerName)
        .sort((a, b) => {
          // First, sort by value
          const valueComparison = a.value - b.value;
          if (valueComparison !== 0) {
            return valueComparison;
          }
          // Then, sort by suit
          const suitOrder = ['Hearts', 'Diamonds', 'Clubs', 'Spades'];
          return suitOrder.indexOf(a.suit) - suitOrder.indexOf(b.suit);
        });
    },
    currentPlayerHands() {
      return this.deck
        .filter(card => card.location === this.currentPlayer.name)
        .sort((a, b) => {
          // First, sort by value
          const valueComparison = a.value - b.value;
          if (valueComparison !== 0) {
            return valueComparison;
          }
          // Then, sort by suit
          const suitOrder = ['Hearts', 'Diamonds', 'Clubs', 'Spades'];
          return suitOrder.indexOf(a.suit) - suitOrder.indexOf(b.suit);
        });
    },
    currentPlayerPickedHands() {
      return this.deck
        .filter(card => card.location === this.currentPlayer.name && card.isPicked)
        .sort((a, b) => {
          // First, sort by value
          const valueComparison = a.value - b.value;
          if (valueComparison !== 0) {
            return valueComparison;
          }
          // Then, sort by suit
          const suitOrder = ['Hearts', 'Diamonds', 'Clubs', 'Spades'];
          return suitOrder.indexOf(a.suit) - suitOrder.indexOf(b.suit);
        });
    },
    
    readyToSubmit() {
      // Check if the player's picked hands are valid

      // If the player's picked hands are empty, return false
      if (this.currentPlayerPickedHands.length === 0) return false;

      // If the public pile is empty, return true
      if (this.publicPile.length === 0) return true;

      // Get the last played card(s) in the public pile
      const topPileCards = this.publicPile.slice(-this.currentPlayerPickedHands.length);

      // Check if the number of picked cards matches the top pile cards
      if (this.currentPlayerPickedHands.length !== topPileCards.length) return false;

      // Check if all picked cards are of the same rank
      const pickedRanks = new Set(this.currentPlayerPickedHands.map(card => card.rank));
      if (pickedRanks.size !== 1) return false;

      // Check if all picked cards are higher than the corresponding top pile cards
      for (let i = 0; i < this.currentPlayerPickedHands.length; i++) {
        if (this.currentPlayerPickedHands[i].value <= topPileCards[i].value) {
          return false;
        }
      }

      // Check for revolution
      const revolution = this.currentPlayerPickedHands.length === 4 && pickedRanks.size === 1;
      if (revolution) {
        // Handle revolution logic, if necessary
      }

      // If all checks pass, return true
      return true;
    },

  },
  methods: {
    sleep(ms) {
      return new Promise(resolve => setTimeout(resolve, ms));
    },
    shuffleArray(array) {
      for (let i = array.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [array[i], array[j]] = [array[j], array[i]];
      }
    },
    getRandomName() {
      let randomName;
      do {
        const randomIndex = Math.floor(Math.random() * this.randomNames.length);
        randomName = this.randomNames[randomIndex];
      } while (this.players.some(player => player.name === randomName));
      return randomName;
    },
    addPlayer() {
      const randomName = this.getRandomName();
      this.players.push({ name: randomName });
    },
    removePlayer(index) {
      this.players.splice(index, 1);
    },
    
    initializeDeck() {
      this.deck =[]
      // Define the suits and ranks with corresponding numbers
      const suits = ['Hearts', 'Diamonds', 'Clubs', 'Spades'];
      const ranks = [
        { rank: '2', value: 2 },
        { rank: '3', value: 3 },
        { rank: '4', value: 4 },
        { rank: '5', value: 5 },
        { rank: '6', value: 6 },
        { rank: '7', value: 7 },
        { rank: '8', value: 8 },
        { rank: '9', value: 9 },
        { rank: '10', value: 10 },
        { rank: 'J', value: 11 },
        { rank: 'Q', value: 12 },
        { rank: 'K', value: 13 },
        { rank: 'A', value: 14 }
      ];

      // Initialize the deck with standard cards
      this.deck = [];
      let id = 1;
      for (let suit of suits) {
        for (let rank of ranks) {
          this.deck.push({ id: id++, suit, rank: rank.rank, value: rank.value , location: 'drawPile',isPicked: false,});
        }
      }

      // Add two Jokers
      this.deck.push({ id: id++, suit: 'Joker', rank: 'Joker', value: 15, location: 'drawPile',isPicked: false });
      this.deck.push({ id: id++, suit: 'Joker', rank: 'Joker', value: 15, location: 'drawPile',isPicked: false });

      // Optional: shuffle the deck
      this.shuffleArray(this.deck);
    },
    async distributeCards() {
      while (this.drawPile.length > 0) {
        for (let player of this.players) {
          if (this.drawPile.length === 0) break; // Break the loop if drawPile is empty
          const card = this.drawPile.shift(); // Remove the top card from drawPile
          if (card) {
            // console.log(`Distributing ${card.id} to ${player.name}`);
            card.location = player.name;
            await this.sleep(20); // Add delay if needed
          }
        }
      }
    },
    goToGamePage() {
      if (!this.readyToPlay) return;
      this.shuffleArray(this.players)
      // Logic to start the game

      // Reset the current player index
      this.currentPlayerIndex = 0;
      this.currentPage = 'game';

      this.initializeDeck()
      // console.log(this.deck)
    },

    getOtherPlayers(currentPlayerName) {
      const currentIndex = this.players.findIndex(player => player.name === currentPlayerName);
      if (currentIndex === -1) return this.players; // Return the full list if currentPlayerName is not found

      const before = this.players.slice(0, currentIndex);
      const after = this.players.slice(currentIndex + 1);

      return after.concat(before);
    },

    goToNextPlayer() {
        // Move to the next player, wrapping around if necessary
        this.currentPlayer.isRevealing = false
        this.unpickAllCurrentPlayerCards();
        this.currentPlayerIndex = (this.currentPlayerIndex + 1) % this.players.length;
    },

    
    drawCard(){
      // if(this.gameStatus !== 'distributed' || !this.drawPile[0]) return
      // if(!this.playerHands(this.playerHands(this.currentPlayer.name[0])))return

      this.playerHands(this.currentPlayer.name)[this.playerHands(this.currentPlayer.name).length-1].location = 'trash'
      // this.drawPile[0].location = this.currentPlayer.name
      
      this.goToNextPlayer()
    },

    
    calculateCardPosition(index, totalCards, card) {
      if (card?.isPicked) {
        const pickedIndex = this.currentPlayerPickedHands.findIndex(c => c.id === card.id);
        const pickedTotal = this.currentPlayerPickedHands.length;

        if (pickedTotal === 1) {
          return {
            left: `50%`,
            top: `0%`,
            transform: `translateX(-50%) translateY(-120%)`
          };
        }

        // Calculate the step percentage for picked cards to fit under 80%
        const pickedStep = 70 / (pickedTotal - 1);
        const pickedPosition = pickedStep * pickedIndex;

        return {
          left: `${30 + pickedPosition}%`, // Start from 20% and use the next 80%
          top: `0%`, // Adjust as needed for vertical position
          transform: `translateX(-${pickedPosition + 30}%) translateY(-120%)`
        };
      }



      if(totalCards == 1){
        return {
          left: `50%`,
          top: `0%`,
          transform: `translateX(-50%)`
        };
      }
      // Define start and end angles for the arc (in radians)
      const startAngle = Math.PI * 21 / 24; // 150 degrees (10 o'clock)
      const endAngle = Math.PI * 3 / 24; // 30 degrees (2 o'clock)
      
      // Calculate the step angle between each card
      const angleStep = (endAngle - startAngle) / (totalCards - 1);
      
      // Calculate the angle for the current card
      const angle = startAngle + angleStep * index;

      // Determine the minRotation based on the number of cards
      let minRotation;
      let xRadius
      let yRadius
      if (totalCards > 20) {
        minRotation = -50;
        xRadius = 165
        yRadius = 160
      } else if (totalCards > 10) {
        minRotation = -35;
        xRadius = 140
        yRadius = 150
      } else {
        minRotation = -15;
        xRadius = 115
        yRadius = 140
      }
      const x = xRadius * Math.cos(angle);
      const y = yRadius * Math.sin(angle);

      
      
      // Calculate the maxRotation
      const maxRotation = -1 * minRotation;
      const rotationStep = (maxRotation - minRotation) / (totalCards - 1);
      const rotation = minRotation + rotationStep * index;
      
      return {
        left: `calc(50% + ${x}px)`,
        top: `calc(80% - ${y}px)`,
        transform: `translateX(-50%) rotate(${rotation}deg)`
      };
    

      

      
    },
    getSuitClass(suit) {
      switch (suit) {
        case 'Hearts':
          return 'suit-hearts';
        case 'Diamonds':
          return 'suit-diamonds';
        case 'Clubs':
          return 'suit-clubs';
        case 'Spades':
          return 'suit-spades';
        default:
          return '';
      }
    },
    pickCard(playerName, card){
      if(playerName !== this.currentPlayer.name) return

      card.isPicked = !card?.isPicked

    },

    
    unpickAllCurrentPlayerCards() {
      this.currentPlayerPickedHands.forEach(card => {
        if (card.isPicked) {
          card.isPicked = false;
        }
      });
    },
    passToNext(){
      this.goToNextPlayer()
      if(this.currentPlayer.name == this.lastSubmitBy) this.clearPublicPile()
    },
    clearPublicPile(){
      this.publicPile.forEach(card => {
        card.location = 'trash';
      });
    },
    submit(){
      this.lastSubmitBy = this.currentPlayer.name
      const currentTime = Date.now();

      this.currentPlayerPickedHands.forEach(card => {
        card.isPicked = false
        card.location = 'publicArea'
        card.updatedAt = currentTime;
        const maxDeg = 20;

        // Generate a random integer between minDeg and maxDeg
        const randomRotation = Math.floor(Math.random() * (maxDeg - -maxDeg + 1)) + (-1 * maxDeg);

        card.rotation = randomRotation

        const verticalPosition = Math.floor(Math.random() * 31);
        const horizontalPosition = Math.floor(Math.random() * 31);

        card.verticalPosition = Math.random() < 0.5 ? `top: ${verticalPosition}%` : `bottom: ${verticalPosition}%`;
        card.horizontalPosition = Math.random() < 0.5 ? `left: ${horizontalPosition}%` : `right: ${horizontalPosition}%`;
      });

      // console.log(this.publicPile)

      this.goToNextPlayer()
    },
    getCardStyle(card) {
      return `
        ${card.verticalPosition};
        ${card.horizontalPosition};
        transform: rotate(${card.rotation}deg)
      `;
    },
    getGap(cardIndex) {
      // Calculate the translateX value based on the card's index
      const translateX = cardIndex * 20;

      // Calculate the rotation value based on the card's index, starting from -15 and incrementing by 10
      const initialRotation = -20;
      const rotation = initialRotation + cardIndex * 7.5;

      return {
        zIndex: cardIndex,
        transform: `translateX(${translateX}px) rotate(${rotation}deg)`,
      };
    },

  },
  async mounted(){
    console.clear()

    this.deck = []
    this.lastSubmitBy = null
    this.currentPlayerIndex = 0

    if(this.developingMode){
      for (let i = 0; i < this.defaultNumber; i++) {
        this.addPlayer();
      }
      await this.sleep(500)

      this.goToGamePage()
      await this.sleep(500)
      
      await this.distributeCards()
      await this.sleep(500)

      // for (let i = 0; i < 15; i++) {
      //   const randomTimes = Math.floor(Math.random() * 3) + 1;

      //   for (let i = 0; i < randomTimes; i++) {
      //     if (this.playerHands(this.currentPlayer.name).length > 0) {
      //       const randomIndex = Math.floor(Math.random() * this.playerHands(this.currentPlayer.name).length);
      //       this.pickCard(this.currentPlayer.name, this.playerHands(this.currentPlayer.name)[randomIndex])
      //       await this.sleep(25)
      //     }
      //   }

      //   this.submit()
      // }

    }
  },
};
</script>

<style>


  :root {

    --game-card-width: 50px;

    --trash-card-width: 60px;
    --trash-card-height: var(--trash-card-width) * 6 / 5;

    /* --game-card-height: calc(var(--game-card-width) * 6 / 5); */
  }

  * {
    touch-action: manipulation;
    -webkit-user-select: none;

    padding: 0;
    margin: 0;
  }

  html{
    /* transform: scale(.8); */
  }
  body {
    font-family: 'Noto Sans JP', sans-serif;
    /* height: 100vh; */
    margin: 0;
    background-color: whitesmoke;

    
  }
  img{
    max-width: 100%;
  }

  #app .inner{
    max-width: 98vw;
    margin: 5vh auto;
  } 

  .input-modal{
    background-color: #fff;
    padding: 20px;
    border-radius: 8px;
    box-shadow: 0 0 10px rgba(0, 0, 0, 0.1);

    max-width: 400px;
    margin: auto;
  }
  h2 {
    margin-top: 0;
    text-align: center;
  }
  .player-input {
    display: flex;
    align-items: center;
    margin-bottom: 10px;
  }
  .player-input input {
    flex-grow: 1;
    padding: 8px;
    border: 1px solid #ccc;
    border-radius: 4px;
  }
  .player-input button {
    background-color: #e74c3c;
    color: #fff;
    border: none;
    border-radius: 4px;
    padding: 8px 12px;
    margin-left: 5px;
    cursor: pointer;
  }
  .add-button, .start-button {
    display: block;
    width: 100%;
    padding: 10px;
    border: none;
    border-radius: 4px;
    margin-top: 10px;
    cursor: pointer;

    background-color: #3498db;
    color: #fff;
  }
  .start-button {
    background-color: #2ecc71;
    color: #fff;
  }
  /* ---------------------------------------- */

  .screens-cotainer{
    display: grid;
    grid-template-columns: repeat(3, 353px);
    row-gap: 10px;
    justify-content: space-between;
    align-items: center;

    /* width: 95vw; */
    margin: auto;
  }

  .screens-cotainer .main-container{
    height: 635px;

    overflow: hidden;

    border: 1px solid black;
    border-radius: 10px;

    background: #13563B;

    position: relative;

    color: white;

    padding: 10px;
  }

  .screens-cotainer .main-container .area-container{
    display: grid;
    grid-template-rows: calc(10% - 10px) calc(20% - 10px) calc(25% - 10px) calc(45% - 10px);
    align-content: space-between;

    /* width: 100%; */
    height: 100%;
  }

  .screens-cotainer .main-container .area-container > *{
    /* overflow: hidden; */
    background: #4B6F44;

    display: flex;
    align-items: center;
  }

  .gameCard{
    display: block;
    width: var(--game-card-width);
    aspect-ratio: 5/8;
    border: 1px solid black;
    border-radius: 5px;
    position: absolute;

    overflow: hidden;

    background: #F9F9FB;
    color: black;
  }

  .gameCard{
    display: grid;
    grid-template-columns: calc(35% - 2.5px) calc(55% - 2.5px);
    justify-content: space-between;

    padding: 5px 2.5px;
  }



  .gameCard .card-info{
    text-align: center;
    font-size: .75em;

    
  }

  .gameCard .card-info .vertical-text{
    writing-mode: vertical-rl;
    /* transform: rotate(-180deg); */
    white-space: nowrap;
  }

  .gameCard .card-detail{
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .gameCard img {
    position: absolute;
    top: 10px;
    left: 10px;
    width: 100%;
    aspect-ratio: 1;
  }

  .suit-icon {
    width: 100%; /* Adjust width to fit your card */
    aspect-ratio: 1;
    /* border: 1px solid black; */
    background: url('./assets/suits.jpg') no-repeat;
    background-size: 215% 215%; /* The full image size (4 suits in a row) */
  }
  .suit-Hearts {
    background-position: 0% 0%;
  }
  .suit-Spades {
    background-position: 0% 100%;
  }
  .suit-Clubs {
    background-position: 100% 0%;
  }
  .suit-Diamonds {
    background-position: 100% 100%;
  }

  /* ---------------------------------------- */

  .other-players-area{
    width: 100%;
    display: flex;
    justify-content: space-around;
    align-items: flex-start;
    
  }
  .playerInfo{
    width: calc(20% - 4px);
    text-align: center;
    font-size: .7em;
  }

  .playerInfo .player-box{
    position: relative;
    border: 1px solid black;
    transition: border-color 0.5s ease-in-out, box-shadow 0.5s ease-in-out;
  }

  .playerInfo .player-box:before {
    content: '' !important;
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    border: 2px solid yellow; /* Change the color as needed */
    box-sizing: border-box; /* Ensure the border is included in the element's size */
    pointer-events: none; /* Ensure the pseudo-element doesn't interfere with interactions */
    opacity: 0; /* Start with opacity 0 */
    transition: opacity .5s ease-in; /* Smooth transition for the pseudo-element */
  }

  .playerInfo .player-box.active:before {
    opacity: 1; /* Set opacity to 1 when active */
  }

  .playerInfo .name-container {
    display: flex;
    align-items: center;
    justify-content: center;
    height: 1.5em; /* Adjust based on your font-size and line-height */
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap; /* Prevent line breaks */
    text-align: center; /* Center text horizontally */
    padding: 5px 3px;
  }
  .playerInfo .name-container p {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap; /* Prevent line breaks */
    width: 100%; /* Ensure the span takes the full width */
    text-align: center; /* Center text horizontally */
  }
  .playerInfo .player-image-container{
    display: block;
    width: 100%;
    aspect-ratio: 1;
    /* background: red; */
  }
  .playerInfo .player-image-container .temp-image{
    display: block;
    margin: auto;
    width: calc(100% - 2px);
    aspect-ratio: 1;

    background: #87A96B;
  }

  .playerInfo span{
    font-size: 1.2em;
    line-height: 2;
  }

  /* ---------------------------------------- */
  .personal-area{
    display: grid !important;
    grid-template-rows: calc(40% - 10px) calc(60% - 10px);
    align-content: space-between;
  }

  .personal-cards-container{
    position: relative;
    display: flex;
    align-items: center;
    width: 100%;
    margin: auto;
    height: 100%;

    /* border: 1px solid black; */
    z-index: 5;
  }

  .action-buttons-container{
    position: absolute;
    bottom: 0%;
    left: 50%;
    transform: translate(-50%,-15%);

    display: grid;
    grid-template-columns: repeat(3, calc(33.3% - 5px));
    justify-content: space-between;

    width: 80%;
    margin: auto;
    z-index: 10;

    transition: all 0.5s;
  }

  .action-buttons-container button{
    background-color: #FFAC1C; /* Green background */
    border: none; /* Remove borders */
    color: black; /* White text */
    padding: 2.5px 0;
    text-align: center; /* Center the text */
    text-decoration: none; /* Remove underline */
    font-size: .9em; /* Increase font size */
    margin: 4px 2px; /* Add some margin */
    cursor: pointer; /* Add a pointer cursor on hover */
    border-radius: 4px; /* Add rounded corners */

    transition: all 0.5s;
  }

  .action-buttons-container .disable-button {
    background-color: #ccc; /* Gray background for disabled state */
    color: #666; /* Dark gray text for disabled state */
    cursor: not-allowed; /* Change cursor to not-allowed */
    pointer-events: none; /* Disable all pointer events */
  }

  /* ---------------------------------------- */
  .public-area{
    display: block !important;
  }
  .public-area .public-cards-container{
    position: relative;
    width: 50%;
    height: 100%;
    margin: auto;
  }
  
  .public-area .public-cards-container .timestamp-group{
    position: absolute;
    width: 57px;
    aspect-ratio: 5 / 8;
  }

  .public-area .public-cards-container .gameCard{
    position: absolute;
    width:50px;
  }

  .public-area .public-cards-container .previous-card{
    /* opacity: .5; */
    filter: grayscale(100%) brightness(50%);
  }
</style>
