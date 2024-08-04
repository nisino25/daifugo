<template>
  <div id="app">
    <div class="inner">

      <div v-if="currentPage === 'before'">
        <div class="input-modal">
          

          <div v-if="!roomOption">
            <button @click="roomOption = 'create'" class="room-button">Create a room</button>
            <hr>
            <button @click="roomOption = 'join'; retriveCode()" class="start-button">Join a room</button>
          </div>

          <template v-if="roomOption && !roomCode">
            <h2>Type your name</h2>
              <div class="player-input">
                <input type="text" v-model="username" placeholder="Enter your username">
              </div>
              <div class="avatar-container">
                <div v-for="(avatar, index) in avatars" :key="index" @click="randomString = avatar.randomString" v-html="avatar.avatar"  :style="{ opacity:  randomString !== avatar.randomString ? '0.3' : '1' }"></div>

                <div class="reload-button" @click="generateAvatars">
                  <i class="fas fa-sync"></i>
                </div>
              </div>
              <div class="player-input" v-if="roomOption === 'join'">
                <input type="number" v-model="tempRoomcode" placeholder="Type room code">
              </div>
              <!-- <button v-if="readyToPlay" @click="randomName()" class="add-button">ランダム</button> -->
              <button @click="roomOption = null" class="back-button" style="background-color: crimson;">Back</button>
              <button @click="username = getRandomName();" class="back-button" style="background-color: black;">Ger Random Name</button>
              <button v-if="readyToPlay && roomOption === 'create'" @click="createARoom()" class="start-button">Create</button>
              <button v-if="tempRoomcode >= 10000 && tempRoomcode <= 99999 && readyToPlay && roomOption === 'join'" @click="joinARoom()" class="start-button">Join</button>
          </template>

          <template v-if="roomOption && roomCode">
            <h2>Welcome {{ username }}!</h2>
            <p>Room code: <strong>{{ roomCode }}</strong></p>
            <hr>
            <template v-for="(player, index) in players" :key="index">
              <p>{{index +1}}.{{ player.name }}</p>
            </template>
            <button v-if="players?.length >= 2 && yourPlayer.isHost"  @click="closeTheRoom()" class="start-button">Close room</button>
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
                  :isActive="otherPlayer == currentPlayer && onlineStatus == 'playing'"
                  :hand="playerHands(otherPlayer.name)"
                />
                
              </template>
            </div>

            <div class="public-area">

              <div class="public-cards-container">
                <template v-for="(group, groupIndex) in groupedPublicPile" :key="groupIndex">
                  <div class="timestamp-group" :class="[{ 'previous-card': !previousCards.includes(group[0]) }]">
                    <template v-for="(card) in group" :key="card.id">
                      <GameCard :card="card" :style="getPileCardLocation(card)" />
                    </template>
                  </div>
                </template>
              </div>

              <div class="detailed-area">
                <span>#{{ roomCode }}</span>
                <!-- <span class="status-badge" style="background: #3581B8;">{{ onlineStatus }}</span> -->
                <span class="status-badge" :class="{ 'undo-badge': !isStairsGoing }" >Stairs</span>
                <span class="status-badge" style="background: crimson; color: white;" :class="{ 'undo-badge': !isRevolutionGoing }" >Revolution</span>
                <div style="display: flex; justify-content: space-around; width: 100%">
                  <i @click="reloadPage()" class="fa fa-refresh" aria-hidden="true"></i>
                  <i v-if="yourPlayer.isHost" @click="resetGame()" class="fa-solid fa-trash"></i>
                </div>
              </div>

            </div>

            <div class="personal-area" :class="{ 'player-mask': currentPlayer !== yourPlayer || onlineStatus !== 'playing' }">

              <PlayerInfo
                :player="yourPlayer"
                :isActive="yourPlayer == currentPlayer && onlineStatus == 'playing'"
                :hand="playerHands(yourPlayer.name)"
              />

              <div class="personal-cards-container">
                
                <template v-for="(card, index) in playerHands(yourPlayer.name)" :key="card.id">
                  <GameCard
                    :class="{ 'card-mask': currentPlayer !== yourPlayer || onlineStatus !== 'playing' }" 
                    :card="card"
                    :style="calculateCardPosition(index, yourPlayerHands.length, card)"
                    @click="pickCard(yourPlayer.name, card)"
                  />
                </template>

                <div class="action-buttons-container" :style="{ transform: currentPlayer == yourPlayer && onlineStatus == 'playing' && movingCards.length == 0 ? 'translate(-50%,-125%)' : 'translate(-50%,0%)'}">
                  <button @click="passToNext()" :class="{ 'disable-button': yourPlayerPickedHands.length > 0  || publicPile.length == 0}">pass</button>
                  <button @click="unpickAllCurrentPlayerCards()" :class="{ 'disable-button': yourPlayerPickedHands.length == 0 }">cancel</button>
                  <button @click="submit()" style="background: #32de84" :class="{ 'disable-button': !readyToSubmit }">submit</button>
                </div>

              </div>


            </div>

          </div>
        </div>


        <div class="moving-cards-container">
            <template v-for="card in movingCards" :key="card.id">
              <GameCard :card="card" :style="getMovingCardLocation(card)"/>
            </template>
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
      onlineStatus: '',

      processedAudioEvents: [],
      publicAudioEvents: [],

      pickedRandomString: null,
      avatars: [],
      randomString: null,

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
    currentPlayerHands() {
      return this.deck
        .filter(card => card.location === this.currentPlayer?.name)
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

    movingCards() {
      return this.deck.filter(card => card.location === 'moving');
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
      if (this.yourPlayerPickedHands.length >= this.previousCards.length && this.yourPlayerPickedHands.length >= 3) {
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

      // this.generateAvatars();

      return randomName;
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
      


      this.currentPlayerIndex = 0
      for(let player of this.players){
        for (let card of this.deck) {

          if (card.location == player.name &&card.suit === 'Diamonds' && card.value === 3) {
            this.onlineStatus = 'playing'
            this.updatingData()
            return; // Correctly breaking out of the loop
          }

        }

        this.currentPlayerIndex++
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
      if(this.onlineStatus == 'distributing') totalCards = this.deck.length / this.players.length
      if (card?.isPicked) {
        const pickedIndex = this.yourPlayerPickedHands.findIndex(c => c.id === card.id);
        const pickedTotal = this.yourPlayerPickedHands.length;

        if (pickedTotal === 1) {
          return {
            left: `50%`,
            top: `-60%`,
            zIndex: 100,
            // transform: `translateY(-120%)`
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

      let transformStyle = `translateX(-50%)   rotate(${rotation}deg)`

      if(totalCards <= 15) transformStyle = `translateX(-50%) translateY(-25%) rotate(${rotation}deg)`

      if(totalCards <= 10) transformStyle = `translateX(-50%) translateY(-50%) rotate(${rotation}deg)`
      
      return {
        left: `calc(50% + ${x}px)`,
        top: `calc(80% - ${y}px)`,
        transform: transformStyle
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
    async passToNext(){
      this.goToNextPlayer()
      if(this.currentPlayer.name == this.lastSubmitBy) await this.clearPublicPile()
      this.updatingData()
    },
    async clearPublicPile(){
      this.isStairsGoing = false
      await this.sleep(1);
      this.publicPile.forEach(card => {
        card.location = 'trash';
      });

      await this.updateAudio('card-clear');
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

      // Generate a random integer between minDeg and maxDeg

      const maxDeg = 2.5;
      let randomRotation = Math.floor(Math.random() * (maxDeg - -maxDeg + 1)) + (-1 * maxDeg);

      const vertRandom = Math.floor(Math.random() * (50 - 5 + 1)) + 5;
      const horzRandom = Math.floor(Math.random() * (65 - 5 + 1)) + 5;
      let tempZindex = 0

      this.yourPlayerPickedHands.forEach(card => {
        card.isPicked = false
        
        card.updatedAt = currentTime;

        card.rotation = 0

        card.submitedBy = this.yourPlayer.name

        const elementId = `card-${card.id}`;
        const cardElement = document.getElementById(elementId);

        const rect = cardElement.getBoundingClientRect();

        card.currentX = rect.left;
        card.currentY = rect.top;
        card.width = cardElement.offsetWidth;
        card.hasDestination = false;
        card.translateX = 0;
        card.zIndex = tempZindex;
        tempZindex++


        card.verticalPosition = vertRandom
        card.horizontalPosition = horzRandom

        card.location = 'moving'
      });

      await this.updatingData()

      await this.sleep(250)
      // await this.sleep(25000)

      // -----------------------------------------
      const container = document.querySelector('.public-area .public-cards-container');
      // if (!container) return null;

      const containerRect = container.getBoundingClientRect();

      let originLeft = 0
      for (let tempCard of tempArr) {
        const deckCard = this.deck.find(card => card.id === tempCard.id);
        deckCard.hasDestination = true
        deckCard.currentX = containerRect.left + (containerRect.width * (deckCard.horizontalPosition / 100));
        deckCard.currentY = containerRect.top + (containerRect.height * (deckCard.verticalPosition / 100));


        deckCard.translateX = originLeft
        originLeft = originLeft + 20

        deckCard.rotation = randomRotation
        randomRotation = randomRotation + 7.5
      }

      

      // -----------------------------------------
      await this.updatingData()
      await this.sleep(550)

      for(let card of this.deck){
        if(card.location == 'moving'){
          card.location = 'publicArea'
        }
      }

      // 8giri
      if(tempArr[tempArr.length - 1].value == 8){
        await this.sleep(1000)
        await this.clearPublicPile()
        await this.updatingData()
        return
      }


      await this.updateAudio('card-submit')

      // check the gamewinner
      if(this.yourPlayerHands.length == 0) {
        this.winner = this.yourPlayer.name
        this.onlineStatus = 'gameOver'
      }


      


      // Filter cards located in 'publicArea' or 'trash'
      const filteredCards = this.deck.filter(card => card.location === 'trash');

      // Change the location to null for the filtered cards
      filteredCards.forEach(card => {
        card.location = null;
      });
      
      await this.goToNextPlayer()
      await this.updatingData()
      if(this.yourPlayerHands.length == 0) await this.updateWinner()



    },
    getPileCardLocation(card){
      if(card.location == 'trash'){
        return `
          top: ${card.verticalPosition}%;
          left: ${card.horizontalPosition - 150}%;
          transform: rotate(${card.rotation}deg) translateX(${card.translateX}px);
          zIndex: ${card.zIndex};
        `;
      }
      return `
        top: ${card.verticalPosition}%;
        left: ${card.horizontalPosition}%;
        transform: rotate(${card.rotation}deg) translateX(${card.translateX}px);
        zIndex: ${card.zIndex};
      `;
    },

    // -------------
    
    generateAvatar() {
      const randomString = Math.random().toString();
      return {
          avatar: window.multiavatar(randomString),
          randomString: randomString
      };
    },
    randomName(){
      this.username = this.getRandomName();
    },
    retriveCode(){
      this.tempRoomcode = localStorage.getItem('latestRoomCode') || 'No room code found'
    },
    async createARoom() {
      if (this.roomCode) return;
      if(!this.username) return;

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
      
      this.players.push({name:this.username, isHost:true,randomString: this.randomString})

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
        publicAudio: [],
        publicAudioEvents: [],
      })

      // console.log('he');
      this.publicAudioEvents = []
      // this.onlineStatus = 'waiting'
      await this.reciveTheData()
    },

    async joinARoom() {

      const docRef = db.collection('rooms').doc(`${this.tempRoomcode}`);

      try {
        const doc = await docRef.get();
        if (doc.exists) {
          if(doc.data().onlineStatus == 'playing') return alert('This room is closed.')

          this.players = doc.data().players;
          this.onlineStatus = doc.data().players;

          if (!this.players.includes(this.username)) this.players.push({name:this.username, isHost:false,randomString:  this.randomString});
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
        // this.winner = doc.data()?.winner
        this.players = doc.data()?.players

        this.publicAudioEvents = doc.data()?.publicAudioEvents
        if(this.publicAudioEvents?.length > 0){

          this.publicAudioEvents.forEach((event) => {
            if (!this.processedAudioEvents.find(e => e.timeStamp === event.timeStamp)) {
              this.playSound(event.fileName);
              this.processedAudioEvents.push(event);
            }
          });
        }

        if(!this.winner && doc.data()?.winner !== 'nobody'){
          this.winner = doc.data()?.winner
          alert(`The game is over ${this.winner} won!`)
        } 
        

        if(this.onlineStatus == 'playing' || this.onlineStatus == 'distributing') {
          this.deck = doc.data().deck

          this.winner = doc.data().winner
          if(this.winner  && this.winner !== 'nobody') alert(`${this.winner} just won! the game is over`)


          this.lastSubmitBy = doc.data()?.lastSubmitBy


          // check if the game is overr


          this.currentPlayerIndex = doc.data().currentPlayerIndex
          this.currentPage = 'game'
          localStorage.setItem('latestRoomCode', null);

          
          this.isStairsGoing = doc.data().isStairsGoing
          this.isRevolutionGoing = doc.data().isRevolutionGoing

          

        }
      
      })
    },



    async closeTheRoom(){

      if(this.players.length <2) return

      this.shuffleArray(this.players)

      // Logic to start the game

      // Reset the current player index
      this.currentPlayerIndex = 0;
      this.currentPage = 'game';

      this.winner = 'nobody'
      this.isStairsGoing = false
      this.isRevolutionGoing = false

      this.deck = []

      this.publicAudioEvents = []
      await this.updateAudio('card-shuffle')

      await this.initializeDeck()

      this.onlineStatus = 'distributing'
      const ref = db.collection('rooms')
      ref.doc(`${this.roomCode}`).update({
        winner: this.winner,
        deck: this.deck,
        players: this.players,
        onlineStatus: this.onlineStatus,
        currentPlayerIndex: this.currentPlayerIndex,
        isStairsGoing: this.isStairsGoing,
        isRevolutionGoing: this.isRevolutionGoing,
        publicAudioEvents: this.publicAudioEvents,

      })

      

      await this.distributeCards()

    },
    updatingData(){
      // if(!this.yourPlayer.isHost && this.onlineStatus == 'distributing') {
      //   console.log(this.onlineStatus + ' ' + this.yourPlayer.name)
      //   return 
      // } 
      const ref = db.collection('rooms')
      ref.doc(`${this.roomCode}`).update({
        lastSubmitBy: this.lastSubmitBy,
        deck: this.deck,
        onlineStatus: this.onlineStatus,
        winner: this.winner,
        currentPlayerIndex: this.currentPlayerIndex,
        isStairsGoing: this.isStairsGoing,
        isRevolutionGoing: this.isRevolutionGoing
      })

    },

    async updateAudio(fileName){
      await this.playSound(fileName);

      this.processedAudioEvents.push({timeStamp: Date.now(),fileName})

      const ref = db.collection('rooms')
      ref.doc(`${this.roomCode}`).update({
        publicAudioEvents : this.processedAudioEvents
      })
    },

    playSound(fileName) {
      try {
        const audio = new Audio(require(`@/assets/sounds/${fileName}.wav`));
        audio.play().catch(error => {
          console.error('Error playing sound:', error);
        });
      } catch (error) {
        console.error('Error loading sound file:', error);
      }
    },

    getMovingCardLocation(card){
      let style

      if(card.submitedBy == this.yourPlayer.name){
        style = {
          left: card.currentX + 'px', 
          top: card.currentY + 'px', 
          transform: `rotate(${card.rotation}deg) translateX(${card.translateX}px)`,
          width : card.width + 'px',
          zIndex: card.zIndex,
        }
      }else if(card.hasDestination == false){
        const landingContainer = document.querySelector(`#player-${card.submitedBy}`);
        const landingContainerRect = landingContainer.getBoundingClientRect();

        card.currentX = landingContainerRect.left + (landingContainerRect.width / 2);
        card.currentY = landingContainerRect.top + (landingContainerRect.height / 2);
          

        style = {
          left: card.currentX + 'px', 
          top: card.currentY + 'px',
          width : '0px',
          height: '0px',
          zIndex: card.zIndex,
        }
      }else{
        const landingContainer = document.querySelector(`.public-cards-container`);
        const landingContainerRect = landingContainer.getBoundingClientRect();

        card.currentX = landingContainerRect.left + (landingContainerRect.width * (card.horizontalPosition / 100));
        card.currentY = landingContainerRect.top + (landingContainerRect.height * (card.verticalPosition / 100));
          

        style = {
          left: card.currentX + 'px', 
          top: card.currentY + 'px',
          transform: `rotate(${card.rotation}deg) translateX(${card.translateX}px)`,
          width : card.width + 'px',
          zIndex: card.zIndex,
        }
      }

      return style
    },

    generateAvatars() {
      this.tempAvatarCode = null;

      this.avatars = [1, 2, 3, 4, 5].map(() => {
        const randomString = Math.random().toString();
        return {
          avatar: window.multiavatar(randomString),
          randomString: randomString
        };
      });


      // this.avatars = [1,2,3,4,5].map(() => window.multiavatar(Math.random().toString()));
      // console.log(Math.random().toString())
    },

  },
  async mounted(){
    console.clear()


    this.generateAvatars()

    this.deck = []
    this.lastSubmitBy = null
    this.currentPlayerIndex = 0

    this.username = this.getRandomName();

    if(this.developingMode){
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

  html, body {
    overflow: hidden;
    height: 100%;
    margin: 0;
    padding: 0;

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

  .avatar-container{
    width: 95%;
    margin: auto;
    display: grid;

    grid-template-columns: 28% 28% 28%;
    justify-content: space-between;
  }

  .avatar-container div{
    margin-bottom: 15px;
  }

  .avatar-container .reload-button{
    font-size: 50px;
    display: flex;
    justify-content: center;
    align-items: center;
    text-align: center;

    color: #01796f;

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
    box-sizing: border-box; /* Ensure the border is included in the element's size */
    pointer-events: none; /* Ensure the pseudo-element doesn't interfere with interactions */
    transition: opacity .5s ease-in; /* Smooth transition for the pseudo-element */
    background-color: rgba(0, 0, 0, 0.5);

    transition: all .3s ease-in-out;
  }

  .playerInfo .player-box.active:before {
    background-color: rgba(0, 0, 0, 0);
    border: 2px solid #DAA520; /* Change the color as needed */
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
    /* width: calc(100% - 2px); */
    width: 100%;
    padding: 5px;
    aspect-ratio: 1;

    box-sizing: border-box;

    background: #87A96B;
  }

  .playerInfo span{
    font-size: 2em;
    line-height: 1.25;

    font-weight: bold;

    text-shadow: 2px 2px 5px rgba(0, 0, 0, 0.5);
  }

  /* ---------------------------------------- */
  .personal-area{
    position: relative;
    
    display: grid !important;
    align-items: flex-end !important;

  }



  .personal-area::before{
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

    border-radius: 10px;

    transition: all .5s ease-in-out;
  }



  .player-mask::before{
    opacity: .5;
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
    background-color: #ccc !important; /* Gray background for disabled state */
    color: #666; /* Dark gray text for disabled state */
    cursor: not-allowed; /* Change cursor to not-allowed */
    pointer-events: none; /* Disable all pointer events */
    padding: 5px 0;
  }

  /* ---------------------------------------- */
  .public-area{
    display: grid !important;
    grid-template-columns: calc(65% - 7.5px) calc(35% - 7.5px);
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
    display: block;
    width: 100%;
    height: 100%
    /* 
    width: 100%;
    height: 100% */
    /* position: absolute;
    width: 57px;
    aspect-ratio: 5 / 8;

    transition: all .5s ease-in-out; */
  }

  .public-area .public-cards-container .gameCard{
    position: absolute;

    transition: all .5s ease-in-out;
    
  }

  .public-area .public-cards-container .previous-card{
    /* opacity: .5; */
    filter: brightness(50%);
  }

  .public-area .detailed-area{
    /* width: 80%; */
    padding: 5px;
    display: grid;
    align-content: space-around;
    justify-content: center;
    box-sizing: border-box;

    text-align: center;

    font-size: .9em;
  }
  

  .public-area .detailed-area .status-badge{
    display: block;
    margin: 0 auto;
    padding: 5px 10px;
    background: #DAA520;
    border-radius: 5px;
    color: black;
    transition: all .5s ease-in-out;

    filter: brightness(1.2);
  }

  .public-area .detailed-area .status-badge.undo-badge{
    filter: brightness(.5);
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

  .moving-cards-container .gameCard{
    position: fixed;
    transition: all .5s ease-in-out;
    box-sizing: border-box;
    
    width: 62px;
    height: 102px;
  }

</style>
