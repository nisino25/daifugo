<template>
  <div id="app">
    <div class="inner">

      <div v-if="currentPage === 'before'">
        <div class="input-modal">
          

          <div v-if="!roomOption">
            <button @click="roomOption = 'create'" class="room-button">ルームを作成</button>
            <hr>
            <button @click="roomOption = 'join'; retriveCode()" class="start-button">ルームに参加</button>
          </div>

          <template v-if="roomOption && !roomCode">
            <h2>プレイヤー名を入力してください</h2>
              <div class="player-input">
                <input type="text" v-model="username" placeholder="名前を入力">
              </div>
              <div class="player-input" v-if="roomOption === 'join'">
                <input type="number" v-model="tempRoomcode" placeholder="ルームコードを入力">
              </div>
              <!-- <button v-if="readyToPlay" @click="randomName()" class="add-button">ランダム</button> -->
              <button @click="roomOption = null" class="back-button" style="background-color: crimson;">戻る</button>
              <button v-if="readyToPlay && roomOption === 'create'" @click="createARoom()" class="start-button">部屋を作る</button>
              <button v-if="tempRoomcode >= 10000 && tempRoomcode <= 99999 && readyToPlay && roomOption === 'join'" @click="joinARoom()" class="start-button">参加する</button>
          </template>

          <template v-if="roomOption && roomCode">
            <h2>ようこそ！ {{ username }}さん</h2>
            <p><strong>{{ roomCode }}</strong>で待機中。</p>
            <hr>
            <template v-for="(player, index) in players" :key="index">
              <p>{{index +1}}.{{ player.name }}</p>
            </template>
            <button v-if="players?.length >= 2 && yourPlayer.isHost"  @click="closeTheRoom()" class="start-button">部屋をクローズ</button>
          </template>
        </div>
      </div>

      <div v-if="currentPage === 'game'">
        <div class="main-container">
              <div class="area-container">

                <div class="other-players-area">
                  <template v-for="otherPlayer in getOtherPlayers()" :key="otherPlayer.name">                  
                    <PlayerInfo
                      :player="otherPlayer"
                      :isActive="otherPlayer == currentPlayer"
                      :hand="playerHands(otherPlayer.name)"
                    />
                    
                  </template>
                </div>

                <div class="public-area">

                  <div class="public-cards-container">
                    <template v-for="(group, groupIndex) in groupedPublicPile" :key="groupIndex">
                      <div class="timestamp-group" :style="getGroupCardStyle(group[0])" :class="[{ 'previous-card': !previousCards.includes(group[0]) }]">
                        <template v-for="(card,cardIndex) in group" :key="card.id">
                          <GameCard :card="card" @click="pickCard(yourPlayer.name, card)" :style="getGap(cardIndex,group)" />
                        </template>
                      </div>
                    </template>
                  </div>

                  <div class="detailed-area">
                    <span>#{{ roomCode }}</span>
                    <span class="status-badge" :class="{ 'undo-badge': !isStairsGoing }" >階段</span>
                    <span class="status-badge" :class="{ 'undo-badge': !isRevolutionGoing }" >革命</span>
                    <div style="display: flex; justify-content: space-between; width: 100%">
                      <i @click="reloadPage()" class="fa fa-refresh" aria-hidden="true"></i>
                      <i v-if="yourPlayer.isHost" @click="resetGame()" class="fa fa-refresh" aria-hidden="true"></i>
                    </div>
                  </div>

                </div>

                <div class="personal-area">

                  <PlayerInfo
                    :player="yourPlayer"
                    :isActive="yourPlayer === currentPlayer"
                    :hand="playerHands(yourPlayer.name)"
                  />

                  <div class="personal-cards-container">
                    
                    <template v-for="(card, index) in playerHands(yourPlayer.name)" :key="card.id">
                      <GameCard
                        :class="{ 'card-mask': currentPlayer !== yourPlayer }" 
                        :card="card"
                        :style="calculateCardPosition(index, yourPlayerHands.length, card)"
                        @click="pickCard(yourPlayer.name, card)"
                      />
                    </template>

                    <div class="action-buttons-container" :style="{ transform: currentPlayer == yourPlayer ? 'translate(-50%,-125%)' : 'translate(-50%,0%)',}">
                      <button @click="passToNext()" :class="{ 'disable-button': yourPlayerPickedHands.length > 0  || publicPile.length == 0}">パス</button>
                      <button @click="unpickAllCurrentPlayerCards()" :class="{ 'disable-button': yourPlayerPickedHands.length == 0 }">キャンセル</button>
                      <button @click="submit()" :class="{ 'disable-button': !readyToSubmit }">出す</button>
                    </div>

                  </div>


                </div>

              </div>
            </div>
      </div>

    </div>
  </div>
</template>

<script>

import db from './firebase.js';

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
      developingMode: false,

      defaultNumber: 2,
      maxPlayerNumber: 6,
      randomNames,


      currentPage: 'before',
      players: [],
      currentPlayerIndex: 0,
      

      deck:[],
      lastSubmitBy: null,

      isRevolutionGoing: false,
      isStairsGoing: false,

      // -------
      roomOption: null,
      roomCode: null,
      tempRoomcode: null,
      generalData: null,

      username: null,
      winner: null,



    };
  },
  computed: {
    readyToPlay() {
      const namePattern = /^[^\s!@#$%^&*(),.?":{}|<>]+$/;

      // Check if the username is valid
      return namePattern.test(this.username) && this.username?.trim() !== '';
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

      // Filter cards located in 'publicArea'
      const filteredCards = this.deck.filter(card => card.location === 'publicArea' || card.location === 'trash');


      // Sort cards by the timestamp in descending order (latest first)
      const sortedByTimestamp = filteredCards.sort((a, b) => b.updatedAt - a.updatedAt);

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

      sortedCards.forEach(card => {
        if (!grouped[card.updatedAt]) {
          grouped[card.updatedAt] = [];
        }
        grouped[card.updatedAt].push(card);
      });
      // Return groups as an array with latest timestamp groups first
      return Object.values(grouped).sort((a, b) =>  a[0].updatedAt - b[0].updatedAt);
    },
    previousCards() {
      return this.publicPile
        .filter(card => card.isPreviousCard)
        .sort((a, b) => {
          const valueA = this.isRevolutionGoing ? a.revolutionValue : a.value;
          const valueB = this.isRevolutionGoing ? b.revolutionValue : b.value;
          return valueA - valueB;
        });
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
    yourPlayerHands() {
      return this.deck
        .filter(card => card.location === this.yourPlayer.name)
        .sort((a, b) => {
          const valueA = this.isRevolutionGoing ? a.revolutionValue : a.value;
          const valueB = this.isRevolutionGoing ? b.revolutionValue : b.value;

          // First, sort by value or revolutionValue
          const valueComparison = valueA - valueB;
          if (valueComparison !== 0) {
            return valueComparison;
          }

          // Then, sort by suit
          const suitOrder = ['Hearts', 'Diamonds', 'Clubs', 'Spades'];
          return suitOrder.indexOf(a.suit) - suitOrder.indexOf(b.suit);
        });
    },
    yourPlayerPickedHands() {
      return this.deck
        .filter(card => card.location === this.username && card.isPicked)
        .sort((a, b) => {
          const valueA = this.isRevolutionGoing ? a.revolutionValue : a.value;
          const valueB = this.isRevolutionGoing ? b.revolutionValue : b.value;

          // First, sort by value or revolutionValue
          const valueComparison = valueA - valueB;
          if (valueComparison !== 0) {
            return valueComparison;
          }

          // Then, sort by suit
          const suitOrder = ['Hearts', 'Diamonds', 'Clubs', 'Spades'];
          return suitOrder.indexOf(a.suit) - suitOrder.indexOf(b.suit);
        });
    },
    
    readyToSubmit() {

      // If the player's picked hands are empty, return false
      if (this.yourPlayerPickedHands.length === 0) return false;

      // --------------------------------------------------------------------

      // If the public pile is empty
      if (this.publicPile.length === 0) {

        // Single card play
        if (this.yourPlayerPickedHands.length === 1) return true;

        // Check if all cards are the same value
        const sameCardCheck = this.yourPlayerPickedHands.every(
            card => card.value === this.yourPlayerPickedHands[0].value
        );
        if (sameCardCheck) return true;

        // Check for sequence (階段)
        if(this.yourPlayerPickedHands.length < 3) return false
        const tempSuit = this.yourPlayerPickedHands[0].suit;
        let tempValue = this.yourPlayerPickedHands[0].value - 1;

        for (let card of this.yourPlayerPickedHands) {
          if (tempSuit !== card.suit || card.value !== ++tempValue) {
              return false;
          }
        }

        return true;
      }

      // --------------------------------------------------------------------
      let wasPreviousRevolution = this.previousCards.length === 4 && this.previousCards.every(card => card.value === this.previousCards[0].value);

      if(wasPreviousRevolution){
        // Check if all cards are the same value
        const sameCardCheck = this.yourPlayerPickedHands.every(
          card => card.value === this.yourPlayerPickedHands[0].value
        );

        if(sameCardCheck){
          // simple case
          const previousValue = this.isRevolutionGoing ? this.previousCards[0].revolutionValue : this.previousCards[0].value;
          const currentValue = this.isRevolutionGoing ? this.yourPlayerPickedHands[0].revolutionValue : this.yourPlayerPickedHands[0].value;
  
          if (currentValue <= previousValue) {
            return false;
          }

          return true
        }

        // stairs

        // revolution
      }

      // Stairs (isStairsGoing)
      if (this.isStairsGoing) {
          // Check if current cards form a sequence (階段) and length is not less than the previous cards
          if (this.yourPlayerPickedHands.length < this.previousCards.length && !wasPreviousRevolution && !wasPreviousRevolution) return false;

          // Check if the lowest number in the current set is higher than the lowest number in the previous set
          const currentLowestValue = this.isRevolutionGoing ? this.yourPlayerPickedHands[0].revolutionValue : this.yourPlayerPickedHands[0].value;
          const previousLowestValue = this.isRevolutionGoing ? this.previousCards[0].revolutionValue : this.previousCards[0].value;
          
          // Handle the revolution case
          if (this.isRevolutionGoing) {
              if (currentLowestValue >= previousLowestValue) return false;
          } else {
              if (currentLowestValue <= previousLowestValue) return false;
          }

          const tempSuit = this.yourPlayerPickedHands[0].suit;
          let tempValue = this.isRevolutionGoing ? this.yourPlayerPickedHands[0].revolutionValue - 1 : this.yourPlayerPickedHands[0].value - 1;

          for (let card of this.yourPlayerPickedHands) {
              const cardValue = this.isRevolutionGoing ? card.revolutionValue : card.value;
              if (tempSuit !== card.suit || cardValue !== ++tempValue) {
                  return false;
              }
          }

          return true;
      }

      // --------------------------------------------------------------------

      // Default regular checking

      // Check stairs
      if (this.yourPlayerPickedHands.length >= this.previousCards.length && this.yourPlayerPickedHands.length > 3) {
          let stairCheck = true;
          const tempSuit = this.yourPlayerPickedHands[0].suit;
          let tempValue = this.isRevolutionGoing ? this.yourPlayerPickedHands[0].revolutionValue + 1 : this.yourPlayerPickedHands[0].value - 1;

          for (let card of this.yourPlayerPickedHands) {
              const cardValue = this.isRevolutionGoing ? card.revolutionValue : card.value;
              if (tempSuit !== card.suit || (this.isRevolutionGoing ? cardValue !== --tempValue : cardValue !== ++tempValue)) {
                  stairCheck = false;
                  break;
              }
          }

          if (stairCheck) return true;
      }



      // Check if all cards are the same value
      const sameCardCheck = this.yourPlayerPickedHands.every(card => card.value === this.yourPlayerPickedHands[0].value);
      if (!sameCardCheck) return false;

      // Check if the length matches the previous cards
      if (this.yourPlayerPickedHands.length < this.previousCards.length && !wasPreviousRevolution) return false;

      // Check if the current cards' value is higher (or lower in revolution) than the previous cards
      const previousValue = this.isRevolutionGoing ? this.previousCards[0].revolutionValue : this.previousCards[0].value;
      const currentValue = this.isRevolutionGoing ? this.yourPlayerPickedHands[0].revolutionValue : this.yourPlayerPickedHands[0].value;

      if (currentValue <= previousValue) {
        return false;
      }

      return true;
    },

    yourPlayer() {
      return this.players.find(player => player.name === this.username);
    },

  },
  methods: {
    sleep(ms) {
      return new Promise(resolve => setTimeout(resolve, ms));
    },
    reloadPage() {
      if (confirm('Are you sure you want to reload the page?')) {
        location.reload();
      }
    },
    resetGame() {
      if (confirm('Are you sure you want to reset the page?')) {
        this.closeTheRoom()
      }
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
      this.deck = []
      // Define the suits and ranks with corresponding numbers
      const suits = ['Hearts', 'Diamonds', 'Clubs', 'Spades'];
      const ranks = [
        { rank: '3', value: 3, revolutionValue: 15 },
        { rank: '4', value: 4, revolutionValue: 14 },
        { rank: '5', value: 5, revolutionValue: 13 },
        { rank: '6', value: 6, revolutionValue: 12 },
        { rank: '7', value: 7, revolutionValue: 11 },
        { rank: '8', value: 8, revolutionValue: 10 },
        { rank: '9', value: 9, revolutionValue: 9 },
        { rank: '10', value: 10, revolutionValue: 8 },
        { rank: 'J', value: 11, revolutionValue: 7 },
        { rank: 'Q', value: 12, revolutionValue: 6 },
        { rank: 'K', value: 13, revolutionValue: 5 },
        { rank: 'A', value: 14, revolutionValue: 4 },
        { rank: '2', value: 15, revolutionValue: 3 },
      ];

      // Initialize the deck with standard cards
      this.deck = [];
      let id = 1;
      for (let suit of suits) {
        for (let rank of ranks) {
          this.deck.push({ id: id++, suit, rank: rank.rank, value: rank.value , revolutionValue: rank.revolutionValue, location: 'drawPile',isPicked: false,});
        }
      }

      // Add one Joker
      // this.deck.push({ id: id++, suit: 'Joker', rank: 'Joker', value: 15, location: 'drawPile',isPicked: false });

      // Optional: shuffle the deck
      this.shuffleArray(this.deck);

      console.log(this.deck)
    },
    async distributeCards() {
      while (this.drawPile.length > 0) {
        for (let player of this.players) {
          if (this.drawPile.length === 0) break; // Break the loop if drawPile is empty
          const card = this.drawPile.shift(); // Remove the top card from drawPile
          if (card) {
            // console.log(`Distributing ${card.id} to ${player.name}`);
            card.location = player.name;
            this.updatingData()
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

    getOtherPlayers() {
      const currentIndex = this.players.findIndex(player => player.name === this.yourPlayer.name);
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
        const pickedIndex = this.yourPlayerPickedHands.findIndex(c => c.id === card.id);
        const pickedTotal = this.yourPlayerPickedHands.length;

        if (pickedTotal === 1) {
          return {
            left: `50%`,
            top: `0%`,
            zIndex: 100,
            transform: `translateY(-120%)`
          };
        }

        // Calculate the step percentage for picked cards to fit under 80%
        const pickedStep = 55 / (pickedTotal - 1);
        const pickedPosition = pickedStep * pickedIndex;
        // let opacityValue = 1
        // if(this.yourPlayer !== this.currentPlayer) opacityValue = .5

        return {
          left: `${35 + pickedPosition}%`, // Start from 20% and use the next 80%
          top: `0%`, // Adjust as needed for vertical position
          transform: `translateX(-${pickedPosition + 40}%) translateY(-120%)`,
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
        yRadius = 210
      } else if (totalCards > 10) {
        minRotation = -40;
        xRadius = 160
        yRadius = 170
      } else if (totalCards > 5) {
        minRotation = -15;
        xRadius = 155
        yRadius = 150
      } else{
        minRotation = -15;
        xRadius = 100
        yRadius = 105
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
      this.yourPlayerPickedHands.forEach(card => {
        if (card.isPicked) {
          card.isPicked = false;
        }
      });
    },
    passToNext(){
      this.goToNextPlayer()
      if(this.currentPlayer.name == this.lastSubmitBy) this.clearPublicPile()
      this.updatingData()
    },
    clearPublicPile(){
      this.isStairsGoing = false
      this.publicPile.forEach(card => {
        card.location = 'trash';
      });
    },
    async submit(){
      this.lastSubmitBy = this.currentPlayer.name
      const currentTime = Date.now();

      let tempRevoultion = false
      
      if(this.yourPlayerPickedHands.length == 4){
        console.log('rev check')
        let flag = true
        const tempValue = this.yourPlayerHands[0]
        for(let card of this.yourPlayerPickedHands){
          if(card.value == tempValue) flag = false
        } 
        
        if(flag){
          tempRevoultion = true
          this.isRevolutionGoing = !this.isRevolutionGoing
        }
      }

      // Check if the yourPlayerPickedHands has more than one distinct value
      const distinctValues = new Set(this.yourPlayerPickedHands.map(card => card.value));
      if (this.yourPlayerPickedHands.length > 2 && distinctValues.size > 1 && !tempRevoultion) {
        this.isStairsGoing = true;
      }

      const tempArr = this.yourPlayerPickedHands

      this.yourPlayerPickedHands.forEach(card => {
        card.isPicked = false
        card.location = 'publicArea'
        card.updatedAt = currentTime;
        const maxDeg = 5;

        // Generate a random integer between minDeg and maxDeg
        const randomRotation = Math.floor(Math.random() * (maxDeg - -maxDeg + 1)) + (-1 * maxDeg);

        card.rotation = randomRotation

        card.verticalPosition = Math.floor(Math.random() * (45 - 5 + 1)) + 5;
        card.horizontalPosition = Math.floor(Math.random() * (60 - 5 + 1)) + 5;
      });

      

      // console.log(this.publicPile)

      if(this.yourPlayerHands.length == 0) this.winner = this.yourPlayer.name

      

      await this.updatingData()

      // 8giri

      if(tempArr[tempArr.length - 1].value == 8){
        await this.sleep(1000)
        this.clearPublicPile()
        await this.updatingData()
      }
      
      await this.goToNextPlayer()
      await this.updatingData()

    },
    getGroupCardStyle(card) {
      let leftPosition = card.horizontalPosition;

      if (card.location === 'trash') {
        leftPosition = -100;
      }

      return `
        top: ${card.verticalPosition}%;
        left: ${leftPosition}%;
        transform: rotate(${card.rotation}deg);
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

    // -------------
    randomName(){
      this.username = this.getRandomName();
    },
    retriveCode(){
      this.tempRoomcode = localStorage.getItem('latestRoomCode') || 'No room code found'
    },
    async createARoom() {
      if (this.roomCode) return;

      let isUnique = false;

      // Generate a unique room code
      while (!isUnique) {
        this.tempRoomcode = Math.floor(10000 + Math.random() * 90000);
        const docRef = db.collection('rooms').doc(`${this.tempRoomcode}`);
        const doc = await docRef.get();
        if (!doc.exists) {
          isUnique = true;
        }
      }

      // console.log(this.roomCode)
      this.roomCode = this.tempRoomcode
      localStorage.setItem('latestRoomCode', this.roomCode)
      

      this.players.push({name:this.username, isHost:true})
      localStorage.userName = this.userName

      // console.log('sending data')
      const ref = db.collection('rooms')
      ref.doc(`${this.roomCode}`).set({
        winner: this.winner,
        games: JSON.stringify([{ gameStatus: 'waiting' }]),
        players: this.players,
        onlineStatus: 'waiting',
        deck: this.deck,
        isStairsGoing: this.isStairsGoing,
        isRevolutionGoing: this.isRevolutionGoing,
      })
      
      // this.onlineStatus = 'waiting'
      this.reciveTheData()
    },

    async joinARoom() {

      const docRef = db.collection('rooms').doc(`${this.tempRoomcode}`);

      try {
        const doc = await docRef.get();
        if (doc.exists) {
          if(doc.data().onlineStatus == 'playing') return alert('This room is closed.')

          this.players = doc.data().players;
          this.onlineStatus = doc.data().players;

          if (!this.players.includes(this.username)) this.players.push({name:this.username, isHost:false});
          this.roomCode = this.tempRoomcode

          await docRef.update({
            players: this.players,
          });
          this.reciveTheData();
        } else {
          console.log('No such document!');
        }
      } catch (error) {
        console.log('Error getting document:', error);
      }
    },

    reciveTheData(){
      
      db.collection("rooms").doc(`${this.roomCode}`)
      .onSnapshot((doc) => {

        this.generalData = doc.data()
        
        // joining room and wait until it closes
        // if(this.currentPage == 'before'){
        this.onlineStatus = doc.data()?.onlineStatus
        this.players = doc.data()?.players
        

        if(this.onlineStatus == 'playing') {
          this.deck = doc.data().deck

          this.winner = doc.data().winner
          if(this.winner) alert(`${this.winner} just won! the game is over`)


          this.lastSubmitBy = doc.data()?.lastSubmitBy


          // check if the game is overr


          this.currentPlayerIndex = doc.data().currentPlayerIndex
          this.currentPage = 'game'
          localStorage.setItem('latestRoomCode', null);

          this.isStairsGoing = doc.data().isStairsGoing
          this.isRevolutionGoing = doc.data().isRevolutionGoing
        }
        
        // if(!this.players.includes(this.username)){
        //   this.joinARoom()
        //   return 
        // }

        

      
        
      
      })
    },

    async closeTheRoom(){
      if(this.players.length <2) return

      this.shuffleArray(this.players)
      // Logic to start the game

      // Reset the current player index
      this.currentPlayerIndex = 0;
      this.currentPage = 'game';

      this.winner = null
      this.isStairsGoing = false
      this.isRevolutionGoing = false

      await this.initializeDeck()

      // alert(this.deck.length)

      const ref = db.collection('rooms')
      ref.doc(`${this.roomCode}`).update({
        winner: this.winner,
        deck: this.deck,
        players: this.players,
        onlineStatus: 'playing',
        currentPlayerIndex: 0,
        isStairsGoing: this.isStairsGoing,
        isRevolutionGoing: this.isRevolutionGoing,
      })

      await this.distributeCards()

      console.log('done closing room ----------------')

    },
    updatingData(){
      const ref = db.collection('rooms')
      ref.doc(`${this.roomCode}`).update({
        lastSubmitBy: this.lastSubmitBy,
        deck: this.deck,
        winner: this.winner,
        currentPlayerIndex: this.currentPlayerIndex,
        isStairsGoing: this.isStairsGoing,
        isRevolutionGoing: this.isRevolutionGoing
      })

    },

  },
  async mounted(){
    console.clear()

    this.deck = []
    this.lastSubmitBy = null
    this.currentPlayerIndex = 0

    this.username = this.getRandomName();

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

  html,body,#app {
    height: 100%;
    margin: 0;
    padding: 0;

    overflow: hidden;

    font-family: 'Noto Sans JP', sans-serif;

    background: #13563B;
  }

  img{
    max-width: 100%;
  }

  .input-modal{
    background-color: #fff;
    padding: 20px;
    border-radius: 8px;
    box-shadow: 0 0 10px rgba(0, 0, 0, 0.1);

    width: 85%;
    max-width: 400px;
    margin: auto;

    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%,-50%);
  }

  .input-modal hr{
    margin: 10px auto;
  }
  h2 {
    margin: 0 auto 10px;
    font-size: 1.25em;
    text-align: center;
  }

  .input-modal strong{
    font-size: 2.5em;
    color: crimson;
    margin-right: 5px;
    
    font-weight: bold;
  }

  /* --------------------------------- */
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
  .input-modal button {
    background-color: #3581B8;
    
    color: #fff;
    margin-left: 5px;
    cursor: pointer;

    display: block;
    width: 50%;
    margin: 10px auto;


    display: block;
    padding: 10px;
    border: none;
    border-radius: 4px;
    margin-top: 10px;
    cursor: pointer;
  }

  .back-button{
    background: #B83A4B;
  }
  .start-button {
    background-color: #13563B !important;
  }
  /* ---------------------------------------- */

  .main-container{
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%,-50%);

    /* background: red; */


    height: 90vh;

    box-sizing: border-box;

    overflow: hidden;

    color: white;

    width: 100%;
    overflow: hidden;
  }

  .area-container{
    height: 100%;
    width: 90vw;

    margin: auto;

    max-width: 425px;
    max-height: 900px;


    display: grid;
    grid-template-rows: calc(20% - 10px) calc(30% - 10px) calc(50% - 10px);
    align-content: space-between;
  }

  .area-container > *{
    /* overflow: hidden; */
    background: #4B6F44;

    display: flex;
    align-items: center;

    border-radius: 10px;
  }

  .gameCard{

    position: relative;
    padding: 5px 2.5px;
    border: 1px solid black;
    border-radius: 5px;
    position: absolute;

    overflow: hidden;

    background: #F9F9FB;
    color: black;

    transition: all .3s ease-in-out;

    width:60px;
    height: 90px;

    box-shadow: 0 4px 8px rgba(0, 0, 0, 0.25);
  }

  .gameCard::before{
    content: '';
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%,-50%);

    width: 100%;
    height: 100%;
    background: black;
    opacity: 0;

    z-index: 1;

    transition: all .5s ease-in-out;

  }

  .gameCard.card-mask::before{
    opacity: .5;
  }




  .gameCard .card-info{
    display: block;
    width: 35%;
    text-align: center;
    font-size: .75em;

    
  }

  .gameCard .card-info .vertical-text{
    writing-mode: vertical-rl;
    /* transform: rotate(-180deg); */
    white-space: nowrap;
  }

  .gameCard .card-detail{
    position: absolute;
    top: 60%;
    left: 50%;
    transform: translate(-50%,-50%);

    width: 50%;
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

  .area-container .other-players-area{
    display: grid;
    grid-template-columns: repeat(5, calc(20% - 5px));
    justify-content: space-between;
    align-items: center;

    width: 100%;
    height: 100%;
    margin: auto;

    padding: 0 10px;

    box-sizing: border-box;

    
  }
  .playerInfo{
    width: 100%;
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
    border: 2px solid #DAA520; /* Change the color as needed */
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
    font-size: 1.7em;
    line-height: 2;
  }

  /* ---------------------------------------- */
  .personal-area{
    position: relative;
    
    display: grid !important;
    align-items: flex-end !important;

  }

  .personal-area .playerInfo{
    position: absolute;
    top: 10px;
    left: 10px;
    width: calc(20% - 10px);
  }

  .personal-cards-container{
    position: relative;
    align-items: center;
    width: 100%;
    height: 60%;

    /* border: 1px solid black; */
    z-index: 5;
  }

  .action-buttons-container{
    position: absolute;
    top: 100%;
    left: 50%;

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
    padding: 5px 0;
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
    padding: 5px 0;
  }

  /* ---------------------------------------- */
  .public-area{
    display: grid !important;
    grid-template-columns: calc(70% - 10px) calc(30% - 10px);
    justify-content: space-between;

    background: unset !important;
    border-radius: unset !important;
  }

  .public-area > *{
    background: #4B6F44;
    border-radius: 10px;

    width: 100%;
    height: 100%;
  }
  .public-area .public-cards-container{
    position: relative;
    margin: auto;
    overflow: hidden;
  }
  
  .public-area .public-cards-container .timestamp-group{
    position: absolute;
    width: 57px;
    aspect-ratio: 5 / 8;

    transition: all .5s ease-in-out;
  }

  .public-area .public-cards-container .gameCard{
    position: absolute;
    
  }

  .public-area .public-cards-container .previous-card{
    /* opacity: .5; */
    filter: grayscale(100%) brightness(50%);
  }

  .public-area .detailed-area{
    /* width: 80%; */
    padding: 5px;
    display: grid;
    align-content: space-around;
    justify-content: center;
    box-sizing: border-box;

    text-align: center;
  }
  

  .public-area .detailed-area .status-badge{
    display: block;
    width: 100%;
    margin: 0 auto;
    padding: 5px 0;
    background: #DAA520;
    border-radius: 5px;
    color: black;
    transition: all .5s ease-in-out;
  }

  .public-area .detailed-area .status-badge.undo-badge{
    opacity: .5
  }

  /* ---------------------------------------- */

  .basic-info{
    position: absolute;
    bottom: 10px;

    width: 90%;

    left: 50%;
    transform: translate(-50%,-50%);

    display: flex;
    justify-content: space-between;
  }
</style>
